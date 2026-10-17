#!/usr/bin/env bash
# 数据库迁移入口：由 scripts/migrate.mjs 解析 .env 并执行迁移。
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$APP_DIR"

exec node scripts/migrate.mjs
