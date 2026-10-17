#!/bin/bash
set -euo pipefail
E=/www/wwwroot/my2077.com/.env
get(){ grep -E "^$1=" "$E" | cut -d= -f2- ; }
A=$(get DB_HOST || true)
if [ -z "${A:-}" ]; then echo "already migrated"; exit 0; fi
B=$(get DB_PORT); C=$(get DB_USER); D=$(get DB_PASS); F=$(get DB_NAME); G=$(get SESSION_SECRET)
cat > "$E" <<EOF
NUXT_DB_HOST=$A
NUXT_DB_PORT=$B
NUXT_DB_USER=$C
NUXT_DB_PASS=$D
NUXT_DB_NAME=$F
NUXT_SESSION_SECRET=$G
NUXT_PUBLIC_SITE_URL=https://my2077.com
PORT=3100
EOF
chmod 600 "$E"
echo "env migrated to NUXT_ prefix"
