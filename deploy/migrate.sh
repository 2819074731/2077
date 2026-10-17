#!/usr/bin/env bash
# 数据库迁移入口：加载 .env，把通用 DB_* 变量映射为 NUXT_DB_*，再执行迁移脚本。
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$APP_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

export NUXT_DB_HOST="${NUXT_DB_HOST:-${DB_HOST:-127.0.0.1}}"
export NUXT_DB_PORT="${NUXT_DB_PORT:-${DB_PORT:-3306}}"
export NUXT_DB_USER="${NUXT_DB_USER:-${DB_USER:-my2077}}"
export NUXT_DB_PASS="${NUXT_DB_PASS:-${DB_PASS:-}}"
export NUXT_DB_NAME="${NUXT_DB_NAME:-${DB_NAME:-my2077}}"

exec node scripts/migrate.mjs
