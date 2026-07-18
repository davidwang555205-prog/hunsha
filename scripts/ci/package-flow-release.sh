#!/usr/bin/env bash
# 云效构建节点执行：从同一 Git 仓库分别构建前端、后端临时发布包。
# 用法：RELEASE_ID=<流水线唯一编号> bash scripts/ci/package-flow-release.sh
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
readonly RELEASE_ID="${RELEASE_ID:?请设置 RELEASE_ID，例如 production-<流水线运行编号>}"
readonly RELEASE_ID_PATTERN='^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'

if [[ ! "$RELEASE_ID" =~ $RELEASE_ID_PATTERN ]]; then
  echo "RELEASE_ID 只能包含字母、数字、点、下划线和连字符，且不能以符号开头：$RELEASE_ID" >&2
  exit 2
fi

readonly ARTIFACT_DIR="$PROJECT_ROOT/artifacts"
readonly STAGING_DIR="$ARTIFACT_DIR/.staging-$RELEASE_ID"
readonly FRONTEND_PACKAGE="$ARTIFACT_DIR/bridal-frontend-$RELEASE_ID.tgz"
readonly BACKEND_PACKAGE="$ARTIFACT_DIR/bridal-backend-$RELEASE_ID.tgz"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/backend/backend" "$STAGING_DIR/frontend/frontend" "$ARTIFACT_DIR"

cd "$PROJECT_ROOT"

echo "[flow-package] 安装并校验前端依赖"
npm ci
npm run typecheck
npm run test
npm run build

echo "[flow-package] 校验并构建 Linux amd64 后端"
(
  cd backend
  go test ./...
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o "$STAGING_DIR/backend/backend/bridal-server" ./cmd/server
)

cp -R backend/migration "$STAGING_DIR/backend/backend/migration"
cp -R dist "$STAGING_DIR/frontend/frontend/dist"

git_commit="$(git rev-parse HEAD)"
for component in backend frontend; do
  cat > "$STAGING_DIR/$component/manifest.env" <<EOF
RELEASE_ID=$RELEASE_ID
GIT_COMMIT=$git_commit
BUILT_AT_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)
COMPONENT=$component
EOF
done

rm -f "$FRONTEND_PACKAGE" "$BACKEND_PACKAGE"
tar -C "$STAGING_DIR/backend" -czf "$BACKEND_PACKAGE" .
tar -C "$STAGING_DIR/frontend" -czf "$FRONTEND_PACKAGE" .
sha256sum "$BACKEND_PACKAGE" | tee "$BACKEND_PACKAGE.sha256"
sha256sum "$FRONTEND_PACKAGE" | tee "$FRONTEND_PACKAGE.sha256"
echo "[flow-package] 已生成：$BACKEND_PACKAGE"
echo "[flow-package] 已生成：$FRONTEND_PACKAGE"
