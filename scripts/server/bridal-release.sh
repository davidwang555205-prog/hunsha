#!/usr/bin/env bash
# 生产服务器发布入口。由云效主机部署任务或管理员手动调用。
# 不构建、不拉取代码、不上传 config.yaml，也不重启 Docker/Nginx/Lucky。
set -euo pipefail

readonly DEPLOY_HOME="${BRIDAL_DEPLOY_HOME:-/home/ubuntu/bridal-deploy}"
readonly BACKEND_DIR="$DEPLOY_HOME/backend"
readonly INCOMING_DIR="$DEPLOY_HOME/incoming"
readonly RELEASES_DIR="$DEPLOY_HOME/releases"
readonly BACKEND_BACKUPS_DIR="$BACKEND_DIR/backups"
readonly FRONTEND_DIR="${BRIDAL_FRONTEND_DIR:-/var/www/bridal-dist}"
readonly FRONTEND_BACKUPS_DIR="$RELEASES_DIR/frontend-backups"
readonly SERVICE_NAME="bridal-backend"
readonly LOCK_FILE="$DEPLOY_HOME/.release.lock"
readonly RELEASE_ID_PATTERN='^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
STAGING_DIR=""
RELEASE_ID=""
GIT_COMMIT=""
BUILT_AT=""

cleanup_staging() {
  if [[ -n "$STAGING_DIR" ]]; then
    rm -rf "$STAGING_DIR"
  fi
  return 0
}
trap cleanup_staging EXIT

usage() {
  cat <<'EOF'
用法：
  bridal-release.sh deploy-backend <backend.tgz>   发布后端二进制与 migration
  bridal-release.sh deploy-frontend <frontend.tgz> 发布前端 dist
  bridal-release.sh restart-backend            仅重启并检查后端
  bridal-release.sh status                     查看服务、HTTP 与当前版本信息
  bridal-release.sh rollback-backend <备份名>  恢复后端二进制；不会回滚数据库 migration
  bridal-release.sh rollback-frontend <备份名> 恢复前端静态文件

发布包必须由 scripts/ci/package-flow-release.sh 从同一 GitHub 仓库生成。
EOF
}

fail() {
  echo "[bridal-release] 错误：$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令：$1"
}

require_safe_name() {
  [[ "$1" =~ $RELEASE_ID_PATTERN ]] || fail "非法发布/备份编号：$1"
}

http_code() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:8888/api/engines || true
}

wait_for_backend() {
  local code attempt
  for attempt in $(seq 1 10); do
    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
      code="$(http_code)"
      # /api/engines 未带登录态返回 401 属于后端正常可用；5xx/000 才视为失败。
      if [[ "$code" != "000" && ! "$code" =~ ^5 ]]; then
        echo "[bridal-release] 后端就绪：HTTP=$code"
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

restart_backend() {
  sudo systemctl restart "$SERVICE_NAME"
  if wait_for_backend; then
    return 0
  fi

  echo "[bridal-release] 后端启动失败，最近日志：" >&2
  sudo journalctl -u "$SERVICE_NAME" --since '3 min ago' -n 80 --no-pager >&2 || true
  return 1
}

read_manifest_value() {
  local key="$1" manifest="$2"
  sed -n "s/^${key}=//p" "$manifest" | head -n 1
}

deploy_backend() {
  local source_dir="$1" release_id="$2" backup_path next_binary
  local timestamp
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_path="$BACKEND_BACKUPS_DIR/bridal-server.${release_id}.${timestamp}"
  next_binary="$BACKEND_DIR/bridal-server.next"

  [[ -x "$source_dir/backend/bridal-server" ]] || fail "后端制品不可执行"
  [[ -d "$source_dir/backend/migration" ]] || fail "发布包缺少 migration 目录"
  [[ -f "$BACKEND_DIR/bridal-server" ]] || fail "当前后端二进制不存在：$BACKEND_DIR/bridal-server"

  mkdir -p "$BACKEND_BACKUPS_DIR"
  cp "$BACKEND_DIR/bridal-server" "$backup_path"
  install -m 0755 "$source_dir/backend/bridal-server" "$next_binary"
  # migration 只增不删。已执行迁移由程序的 schema_migrations 记录自动跳过。
  rsync -a "$source_dir/backend/migration/" "$BACKEND_DIR/migration/"
  mv -f "$next_binary" "$BACKEND_DIR/bridal-server"

  echo "[bridal-release] 后端已替换，回滚备份：$(basename "$backup_path")"
  if ! restart_backend; then
    echo "[bridal-release] 尝试恢复后端二进制：$(basename "$backup_path")" >&2
    install -m 0755 "$backup_path" "$BACKEND_DIR/bridal-server"
    restart_backend || true
    fail "新后端未通过健康检查；二进制已尝试恢复。数据库 migration 不会自动回滚。"
  fi
}

deploy_frontend() {
  local source_dir="$1" release_id="$2" backup_dir
  backup_dir="$FRONTEND_BACKUPS_DIR/$release_id"

  [[ -f "$source_dir/frontend/dist/index.html" ]] || fail "前端制品缺少 index.html"
  sudo install -d -m 0755 "$FRONTEND_DIR" "$FRONTEND_BACKUPS_DIR"
  if [[ -n "$(sudo find "$FRONTEND_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    sudo install -d -m 0755 "$backup_dir"
    sudo rsync -a --delete "$FRONTEND_DIR/" "$backup_dir/"
  fi

  # nginx 以目录 bind mount 方式挂载该路径，不能 mv 替换目录；只能在原目录同步文件。
  sudo rsync -a --delete "$source_dir/frontend/dist/" "$FRONTEND_DIR/"
  echo "[bridal-release] 前端已同步：$FRONTEND_DIR"
  [[ -d "$backup_dir" ]] && echo "[bridal-release] 前端回滚备份：$(basename "$backup_dir")"
}

unpack_release() {
  local archive="$1" expected_component="$2" manifest component
  [[ -f "$archive" ]] || fail "发布包不存在：$archive"
  require_command tar
  require_command rsync
  require_command curl
  require_command flock

  mkdir -p "$INCOMING_DIR" "$RELEASES_DIR"
  STAGING_DIR="$(mktemp -d "$RELEASES_DIR/.incoming.XXXXXX")"
  tar -xzf "$archive" -C "$STAGING_DIR" --no-same-owner --no-same-permissions

  manifest="$STAGING_DIR/manifest.env"
  [[ -f "$manifest" ]] || fail "发布包缺少 manifest.env"
  RELEASE_ID="$(read_manifest_value RELEASE_ID "$manifest")"
  GIT_COMMIT="$(read_manifest_value GIT_COMMIT "$manifest")"
  BUILT_AT="$(read_manifest_value BUILT_AT_UTC "$manifest")"
  component="$(read_manifest_value COMPONENT "$manifest")"
  require_safe_name "$RELEASE_ID"
  [[ -n "$GIT_COMMIT" && -n "$BUILT_AT" && "$component" == "$expected_component" ]] || fail "发布包 manifest 不完整或组件不匹配"
}

record_component() {
  local component="$1" state_file="$RELEASES_DIR/current.env" next_file
  next_file="$RELEASES_DIR/current.env.next"
  if [[ -f "$state_file" ]]; then
    grep -v "^${component}_" "$state_file" > "$next_file" || true
  else
    : > "$next_file"
  fi
  cat >> "$next_file" <<EOF
${component}_RELEASE_ID=$RELEASE_ID
${component}_GIT_COMMIT=$GIT_COMMIT
${component}_BUILT_AT_UTC=$BUILT_AT
${component}_DEPLOYED_AT_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
  mv -f "$next_file" "$state_file"
}

deploy_backend_archive() {
  unpack_release "$1" backend
  echo "[bridal-release] 开始后端发布 release=$RELEASE_ID commit=$GIT_COMMIT built_at=$BUILT_AT"
  deploy_backend "$STAGING_DIR" "$RELEASE_ID"
  record_component BACKEND
  rm -rf "$STAGING_DIR"
  STAGING_DIR=""
  echo "[bridal-release] 后端发布完成：$RELEASE_ID"
}

deploy_frontend_archive() {
  unpack_release "$1" frontend
  echo "[bridal-release] 开始前端发布 release=$RELEASE_ID commit=$GIT_COMMIT built_at=$BUILT_AT"
  deploy_frontend "$STAGING_DIR" "$RELEASE_ID"
  record_component FRONTEND
  rm -rf "$STAGING_DIR"
  STAGING_DIR=""
  echo "[bridal-release] 前端发布完成：$RELEASE_ID"
}

rollback_backend() {
  local backup_name="$1" backup_path
  require_safe_name "$backup_name"
  backup_path="$BACKEND_BACKUPS_DIR/$backup_name"
  [[ -f "$backup_path" ]] || fail "后端备份不存在：$backup_path"
  install -m 0755 "$backup_path" "$BACKEND_DIR/bridal-server"
  restart_backend || fail "回滚后的后端未通过健康检查"
  echo "[bridal-release] 后端已恢复：$backup_name"
}

rollback_frontend() {
  local backup_name="$1" backup_dir
  require_safe_name "$backup_name"
  backup_dir="$FRONTEND_BACKUPS_DIR/$backup_name"
  [[ -d "$backup_dir" ]] || fail "前端备份不存在：$backup_dir"
  sudo rsync -a --delete "$backup_dir/" "$FRONTEND_DIR/"
  echo "[bridal-release] 前端已恢复：$backup_name"
}

status() {
  local code
  echo "backend enabled=$(sudo systemctl is-enabled "$SERVICE_NAME" 2>/dev/null || true) active=$(sudo systemctl is-active "$SERVICE_NAME" 2>/dev/null || true)"
  code="$(http_code)"
  echo "backend HTTP=$code"
  curl -sS -o /dev/null -w 'nginx HTTP=%{http_code}\n' --max-time 10 http://127.0.0.1:8080/ || true
  [[ -f "$RELEASES_DIR/current.env" ]] && cat "$RELEASES_DIR/current.env" || true
}

main() {
  local command_name="${1:-}"
  case "$command_name" in
    deploy-backend)
      [[ $# -eq 2 ]] || { usage >&2; exit 2; }
      exec 9>"$LOCK_FILE"
      flock -n 9 || fail "已有发布正在执行：$LOCK_FILE"
      deploy_backend_archive "$2"
      ;;
    deploy-frontend)
      [[ $# -eq 2 ]] || { usage >&2; exit 2; }
      exec 9>"$LOCK_FILE"
      flock -n 9 || fail "已有发布正在执行：$LOCK_FILE"
      deploy_frontend_archive "$2"
      ;;
    restart-backend)
      [[ $# -eq 1 ]] || { usage >&2; exit 2; }
      restart_backend
      ;;
    rollback-backend)
      [[ $# -eq 2 ]] || { usage >&2; exit 2; }
      exec 9>"$LOCK_FILE"
      flock -n 9 || fail "已有发布正在执行：$LOCK_FILE"
      rollback_backend "$2"
      ;;
    rollback-frontend)
      [[ $# -eq 2 ]] || { usage >&2; exit 2; }
      exec 9>"$LOCK_FILE"
      flock -n 9 || fail "已有发布正在执行：$LOCK_FILE"
      rollback_frontend "$2"
      ;;
    status)
      [[ $# -eq 1 ]] || { usage >&2; exit 2; }
      status
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
# 让云效主机部署任务获得明确的成功退出码；任一发布步骤失败时，set -e 已会提前退出。
exit 0
