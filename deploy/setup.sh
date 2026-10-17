#!/bin/bash
set -euo pipefail
APP=/www/wwwroot/my2077.com
MYSQL="/www/server/mysql/bin/mysql --defaults-file=/root/.my.cnf"

if [ ! -f "$APP/.env" ]; then
  DBPASS=$(head -c 30 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
  SECRET=$(head -c 40 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
  cat > "$APP/.env" <<EOF
NUXT_DB_HOST=127.0.0.1
NUXT_DB_PORT=3306
NUXT_DB_USER=my2077
NUXT_DB_PASS=$DBPASS
NUXT_DB_NAME=my2077
NUXT_SESSION_SECRET=$SECRET
NUXT_PUBLIC_SITE_URL=https://my2077.com
PORT=3100
EOF
  chmod 600 "$APP/.env"
  echo ".env created"
else
  echo ".env exists, keeping"
fi

DB_PASS=$(grep -E '^NUXT_DB_PASS=' "$APP/.env" | cut -d= -f2-)
DB_USER=$(grep -E '^NUXT_DB_USER=' "$APP/.env" | cut -d= -f2-)
DB_NAME=$(grep -E '^NUXT_DB_NAME=' "$APP/.env" | cut -d= -f2-)

$MYSQL -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;"
$MYSQL "$DB_NAME" < "$APP/schema.sql"
echo "database ready: $DB_NAME ($DB_USER)"
$MYSQL "$DB_NAME" -e "SHOW TABLES;"
