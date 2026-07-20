#!/usr/bin/env bash
# sync-to-codeup.sh -- 把指定分支从 GitHub 增量推送到阿里云 Codeup（云效流水线源）
#
# 用法：
#   1. 首次跑过 mirror-to-codeup.sh 后，codeup remote 已配好
#   2. 本地开发完成后：
#        ./scripts/dev-tools/sync-to-codeup.sh dev-dao      # 同步 dev-dao
#        ./scripts/dev-tools/sync-to-codeup.sh production  # 同步 production（云效流水线触发源）
#
# 日常：开发推 GitHub（origin）→ 跑这个脚本推 Codeup（codeup）→ 云效从 Codeup clone。
#
# 用法变体：
#   --all-branches   推送 origin 所有分支到 codeup（首次初始化后增量同步推荐）
#   --tags           额外推送所有 tag

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "用法: $0 [--all-branches | <branch-name>...]"
  echo "  例: $0 production                # 推一个分支"
  echo "  例: $0 dev-dao production        # 推多个分支"
  echo "  例: $0 --all-branches --tags     # 推所有分支+tag"
  exit 1
fi

REMOTE_NAME="codeup"
if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  echo "[ERROR] remote '$REMOTE_NAME' 未配。先跑 mirror-to-codeup.sh 一次性镜像。"
  exit 1
fi

PUSH_TAGS="false"

# 解析 --tags
ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--tags" ]]; then
    PUSH_TAGS="true"
  else
    ARGS+=("$arg")
  fi
done

if [[ ${#ARGS[@]} -eq 1 && "${ARGS[0]}" == "--all-branches" ]]; then
  echo "[INFO] 推送 origin 所有分支到 $REMOTE_NAME..."
  git push "$REMOTE_NAME" 'refs/remotes/origin/*:refs/heads/*'
  if [[ "$PUSH_TAGS" == "true" ]]; then
    echo "[INFO] 推送所有 tag..."
    git push "$REMOTE_NAME" --tags
  fi
else
  for branch in "${ARGS[@]}"; do
    if ! git rev-parse --verify "$branch" >/dev/null 2>&1; then
      echo "[ERROR] 分支不存在: $branch"
      exit 1
    fi
    echo "[INFO] 推送 $branch 到 $REMOTE_NAME..."
    git push "$REMOTE_NAME" "$branch"
  done
  if [[ "$PUSH_TAGS" == "true" ]]; then
    echo "[INFO] 推送所有 tag..."
    git push "$REMOTE_NAME" --tags
  fi
fi

echo
echo "[OK] 同步完成。云效流水线（指向 $REMOTE_NAME/$branch）下次触发时将拉到最新代码。"
