#!/usr/bin/env bash
# 数据库备份入口：由 scripts/backup.mjs 解析 .env 并导出数据库。
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$APP_DIR"

exec node scripts/backup.mjs
