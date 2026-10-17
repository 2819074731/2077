# 数据库备份

`deploy/backup.sh` 会读取项目根目录的 `.env`，使用 `mysqldump` 将数据库导出到 `/www/backup/my2077`，文件名为 `db-YYYYmmdd-HHMM.sql.gz`，默认保留 14 天。

## 依赖

- mysqldump
- gzip
- rclone（可选，仅在设置 RCLONE_REMOTE 时使用）

## 环境变量

脚本优先使用进程环境变量，其次使用 `.env` 中的同名变量。

- `APP_DIR`：项目目录，默认 `/www/wwwroot/my2077.com`
- `ENV_FILE`：环境文件路径，默认 `$APP_DIR/.env`
- `BACKUP_DIR`：备份目录，默认 `/www/backup/my2077`
- `RETENTION_DAYS`：保留天数，默认 14
- `RCLONE_REMOTE`：rclone 目标，例如 `remote:my2077-backup`
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASS` / `DB_NAME`：数据库连接信息
- 未设置上述数据库变量时，会回退读取 `.env` 中的 `NUXT_DB_HOST`、`NUXT_DB_PORT`、`NUXT_DB_USER`、`NUXT_DB_PASS`、`NUXT_DB_NAME`

## 安装定时任务

```bash
crontab -e
```

```bash
# 每天凌晨 3:15 备份数据库
15 3 * * * /www/wwwroot/my2077.com/deploy/backup.sh >> /var/log/my2077-backup.log 2>&1
```

保存后可通过以下命令确认任务已写入：

```bash
crontab -l
```

## 手动执行

```bash
/www/wwwroot/my2077.com/deploy/backup.sh
```

## 恢复示例

```bash
gzip -dc /www/backup/my2077/db-20260101-0315.sql.gz | mysql -h 127.0.0.1 -u my2077 -p my2077
```
