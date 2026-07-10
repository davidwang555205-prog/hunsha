#!/usr/bin/env bash
# 备份 PostgreSQL（pg_dump -> gzip），保留最近 30 份
# 用法：bash scripts/backup-db.sh
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
[ -f .env ] && . ./.env
set +a

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TS=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/bridal-pg-$TS.sql.gz"

docker compose exec -T -e PGPASSWORD="$PG_PASSWORD" postgres \
  pg_dump -U "$PG_USER" -d "$PG_DB" | gzip > "$FILE"

echo "[backup-db] $FILE ($(du -h "$FILE" | cut -f1))"

# 保留最近 30 份
ls -t "$BACKUP_DIR"/bridal-pg-*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm -f
echo "[backup-db] 清理完成，保留最近 30 份"
