#!/usr/bin/env bash
# 数据库备份：读取 .env，使用 mysqldump 导出并压缩，默认保留 14 天。
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/my2077.com}"
BACKUP_DIR="${BACKUP_DIR:-/www/backup/my2077}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

DB_HOST="${DB_HOST:-${NUXT_DB_HOST:-127.0.0.1}}"
DB_PORT="${DB_PORT:-${NUXT_DB_PORT:-3306}}"
DB_USER="${DB_USER:-${NUXT_DB_USER:-my2077}}"
DB_PASS="${DB_PASS:-${NUXT_DB_PASS:-}}"
DB_NAME="${DB_NAME:-${NUXT_DB_NAME:-my2077}}"

if [ -z "$DB_NAME" ]; then
  echo "[backup] 缺少数据库名称" >&2
  exit 1
fi

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "[backup] 未找到 mysqldump" >&2
  exit 1
fi

if ! command -v gzip >/dev/null 2>&1; then
  echo "[backup] 未找到 gzip" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TS="$(date +%Y%m%d-%H%M)"
FILE="$BACKUP_DIR/db-$TS.sql.gz"
TMP="$FILE.tmp"

cleanup() {
  if [ -f "$TMP" ]; then
    rm -f "$TMP"
  fi
}
trap cleanup EXIT

echo "[backup] 开始备份数据库 $DB_NAME"

MYSQL_PWD="$DB_PASS" mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --single-transaction \
  --quick \
  --routines \
  --default-character-set=utf8mb4 \
  "$DB_NAME" | gzip -c > "$TMP"

mv "$TMP" "$FILE"
trap - EXIT

echo "[backup] 备份完成：$FILE"

find "$BACKUP_DIR" -type f -name 'db-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

if [ -n "${RCLONE_REMOTE:-}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "[backup] 未找到 rclone" >&2
    exit 1
  fi
  rclone copy "$FILE" "$RCLONE_REMOTE"
  echo "[backup] 已上传到 $RCLONE_REMOTE"
fi
