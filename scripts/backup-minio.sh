#!/usr/bin/env bash
# 备份 MinIO bucket（mc mirror 到本地目录），需 docker compose 已启动
# 用法：bash scripts/backup-minio.sh
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
[ -f .env ] && . ./.env
set +a

BACKUP_DIR="$(pwd)/backups/minio"
mkdir -p "$BACKUP_DIR"

# compose 默认网络名：{目录名}_default
NETWORK="bridal-dress-content-studio_default"

docker run --rm --network "$NETWORK" --entrypoint sh -v "$BACKUP_DIR:/backup" minio/mc -c \
  "mc alias set local http://minio:9000 '${MINIO_ACCESS_KEY}' '${MINIO_SECRET_KEY}' >/dev/null \
   && mc mirror --overwrite 'local/${MINIO_BUCKET}' /backup"

echo "[backup-minio] -> $BACKUP_DIR ($(find "$BACKUP_DIR" -type f | wc -l | tr -d ' ') 个文件)"
