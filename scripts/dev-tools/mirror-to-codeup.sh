#!/usr/bin/env bash
# mirror-to-codeup.sh -- 把本地 GitHub 仓库一次性全量镜像到阿里云 Codeup
#
# 用法：
#   1. 在阿里云 Codeup 控制台创建空仓库 bridal-dress-content-studio（不要初始化 README/分支）
#   2. 拿到 Codeup 仓库 URL（推荐 HTTPS + Personal Access Token 形式）：
#        https://oauth2:<token>@codeup.aliyun.com/<namespace>/bridal-dress-content-studio.git
#   3. 跑本脚本：./scripts/dev-tools/mirror-to-codeup.sh <codeup-url>
#
# 效果：把 origin 的所有分支、所有 tag、所有 commit 一次性推送到 Codeup。
# 之后日常开发仍然推 GitHub（origin），本脚本 + 下方 sync-to-codeup.sh 用于手动同步。
#
# 一次性脚本，--mirror 后 origin 与 codeup 内容应一致。后续用 sync-to-codeup.sh 增量同步。

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "用法: $0 <codeup-repo-url>"
  echo "  例: $0 https://oauth2:TOKEN@codeup.aliyun.com/myorg/bridal-dress-content-studio.git"
  exit 1
fi

CODEUP_URL="$1"
REMOTE_NAME="codeup"

if git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  echo "[INFO] remote '$REMOTE_NAME' 已存在，当前 URL: $(git remote get-url "$REMOTE_URL")"
  git remote set-url "$REMOTE_NAME" "$CODEUP_URL"
else
  git remote add "$REMOTE_NAME" "$CODEUP_URL"
fi

echo "[INFO] 推送所有分支 + tag 到 $REMOTE_NAME（--mirror）..."
git push "$REMOTE_NAME" --mirror

echo
echo "[OK] 一次性镜像完成。下一步："
echo "  - 在云效 Flow 流水线「代码源」把仓库来源从 GitHub 改成这个 Codeup 仓库"
echo "  - 触发器分支保持 production"
echo "  - 后续日常同步：./scripts/dev-tools/sync-to-codeup.sh <branch>"
