#!/usr/bin/env bash
# 初始化 MinIO bucket（手动备用；Node 启动时也会自动 ensureBucket，幂等）
# 用法：bash scripts/init-minio.sh  （需先 docker compose up -d）
set -euo pipefail

cd "$(dirname "$0")/.."

# 读 .env
set -a
[ -f .env ] && . ./.env
set +a

ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
SECRET_KEY="${MINIO_SECRET_KEY:-change_me}"
BUCKET="${MINIO_BUCKET:-bridal-images}"

echo "[init-minio] bucket=${BUCKET}"

docker compose exec -T minio sh -c \
  "mc alias set local http://localhost:9000 '${ACCESS_KEY}' '${SECRET_KEY}' >/dev/null \
   && (mc mb -p 'local/${BUCKET}' 2>/dev/null || true) \
   && mc ls 'local/${BUCKET}'"

echo "[init-minio] done"
