# 安装部署

本文说明如何把 2077 导航部署到一台 Linux 服务器。示例路径以 `/www/wwwroot/my2077.com` 为准，可按实际环境调整。

## 1. 环境要求

| 组件 | 版本 | 说明 |
| --- | --- | --- |
| Linux | x86_64，主流发行版 | Debian、Ubuntu、Rocky Linux 均可 |
| Node.js | 24.x 推荐 | Nuxt 4 需要现代 Node；生产环境建议与 `ecosystem.config.cjs` 保持一致 |
| pnpm | 10.x | 可用 Corepack 启用 |
| MySQL | 8.0+ 或 MariaDB 10.11+ | 需要 `utf8mb4` |
| Nginx | 1.20+ | 反向代理与 HTTPS |
| PM2 | 最新版 | 进程守护与 cluster 重载 |
| Git | 任意近版本 | 拉取源码 |

最低配置建议 1 核 2 GB，推荐 2 核 4 GB。GitHub 代理、死链巡检和备份会占用额外内存与带宽。

## 2. 安装基础软件

```bash
# 安装 Node.js 24（示例使用 nvm，也可使用系统包或宝塔 Node 管理器）
nvm install 24
nvm use 24

# 启用 pnpm
corepack enable
corepack prepare pnpm@10 --activate

# 安装 PM2
npm install -g pm2

# 确认版本
node -v
pnpm -v
pm2 -v
mysql --version
nginx -v
```

## 3. 获取源码

```bash
mkdir -p /www/wwwroot
cd /www/wwwroot

# 替换为实际仓库地址
git clone https://gitea.com/qiqius/2077.git my2077.com
cd my2077.com
```

如果服务器无法直接访问仓库，可在本地打包源码后上传，再解压到目标目录。

## 4. 创建数据库

使用有建库权限的 MySQL 账号执行：

```sql
CREATE DATABASE IF NOT EXISTS `my2077`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

CREATE USER IF NOT EXISTS 'my2077'@'127.0.0.1' IDENTIFIED BY '替换为强密码';
GRANT ALL PRIVILEGES ON `my2077`.* TO 'my2077'@'127.0.0.1';
FLUSH PRIVILEGES;
```

导入基础表结构：

```bash
mysql -h 127.0.0.1 -u my2077 -p my2077 < schema.sql
```

`schema.sql` 只负责首次建表。后续版本通过 `server/database/migrations/` 中的增量脚本升级。

## 5. 配置环境变量

```bash
cp .env.example .env
chmod 600 .env
```

编辑 `.env`，至少修改以下内容：

```dotenv
NUXT_DB_HOST=127.0.0.1
NUXT_DB_PORT=3306
NUXT_DB_USER=my2077
NUXT_DB_PASS=替换为数据库密码
NUXT_DB_NAME=my2077
NUXT_SESSION_SECRET=替换为随机字符串
NUXT_PUBLIC_SITE_URL=https://你的域名
PORT=3100
```

生成会话密钥：

```bash
openssl rand -hex 32
```

注意：

- `NUXT_SESSION_SECRET` 必须使用足够长的随机值，且不要提交到仓库。
- `NUXT_PUBLIC_SITE_URL` 会影响 canonical、sitemap、分享链接和邮件中的绝对地址。
- `.env` 权限建议为 `600`。
- `ecosystem.config.cjs` 会读取同目录 `.env`，无需在 PM2 配置里重复填写密码。

## 6. 执行数据库迁移

```bash
bash deploy/migrate.sh
```

脚本通过 `scripts/migrate.mjs` 读取 `.env`，按文件名顺序执行未应用的迁移，并把执行记录写入 `schema_migrations` 表。重复执行是安全的。

也可以直接使用 Node：

```bash
node scripts/migrate.mjs
```

## 7. 构建

```bash
pnpm install --frozen-lockfile
pnpm build
```

构建产物位于 `.output/`。Nitro 使用 `node-server` preset，入口为 `.output/server/index.mjs`。

构建时注意：

- 构建会先清空 `.output`，请避免直接在生产目录构建并同时提供服务。
- 推荐使用后文的零停机发布脚本。
- 服务器内存较小时，构建期间不要同时运行大量任务。

## 8. 启动服务

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

检查状态与日志：

```bash
pm2 status
pm2 logs my2077-nav --lines 100
```

服务默认监听 `127.0.0.1:3100`。如果服务器 Node 路径不同，请修改 `ecosystem.config.cjs` 中的 `interpreter`：

```js
interpreter: '/your/node/bin/node'
```

也可以删除该字段，让 PM2 使用当前环境的 Node。

PM2 开机自启：

```bash
pm2 startup
```

按提示执行输出的命令，然后再次执行 `pm2 save`。

## 9. 配置 Nginx

项目提供了参考配置：

```bash
cp deploy/nginx-my2077.conf /etc/nginx/conf.d/my2077.conf
```

把 `server_name` 改成实际域名，确认反代地址与端口：

```nginx
location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 120s;
}
```

检查并重载：

```bash
nginx -t
systemctl reload nginx
```

`X-Real-IP` 与 `X-Forwarded-For` 必须由 Nginx 覆盖写入，限流和天气定位会读取它们。

HTTPS 可使用 Certbot 或服务器面板申请证书。启用 HTTPS 后，把 `NUXT_PUBLIC_SITE_URL` 改成 `https://` 地址并重启服务。

## 10. 创建第一个管理员

1. 打开 `/register` 注册账号。注册需要邮箱、密码和 QQ 号。
2. 在数据库中把该账号设为管理员：

```sql
UPDATE users SET is_admin = 1 WHERE email = '你的邮箱';
```

3. 退出并重新登录，访问 `/admin`。

之后可以在后台「用户管理」中把其他用户设为管理员。

## 11. 验证安装

```bash
# 首页
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/

# 健康检查
curl -s http://127.0.0.1:3100/api/health

# 许可页
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/license

# 版权响应头
curl -sI http://127.0.0.1:3100/ | grep -i x-license

# 公网
curl -sI https://你的域名/ | head
```

正常结果：

- `/` 返回 `200`
- `/api/health` 返回 `{"status":"ok",...}`
- `/license` 返回 `200`
- 响应头包含 `X-License: AGPL-3.0-only`

## 12. 零停机发布

`deploy/release.sh` 会在临时目录构建新版本，预检通过后原子切换 `.output`，再平滑重载 PM2 cluster。构建或健康检查失败会自动回滚。

```bash
# 依赖有变化时先安装
pnpm install --frozen-lockfile

# 执行零停机发布
bash deploy/release.sh
```

常用环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `APP_DIR` | `/www/wwwroot/my2077.com` | 源码目录 |
| `RELEASE_ROOT` | `/www/wwwroot/releases` | 历史版本目录 |
| `NODE_BIN` | `/www/server/nodejs/v24.21.0/bin` | Node 可执行文件目录 |
| `HEALTH_URL` | `http://127.0.0.1:3100/` | 健康检查地址 |
| `SKIP_INSTALL` | `0` | 设为 `1` 时跳过 `pnpm install` |

历史版本会保留在 `RELEASE_ROOT`，便于手动回滚。

## 13. 升级

```bash
# 1. 备份数据库
bash deploy/backup.sh

# 2. 拉取新代码
git pull

# 3. 安装依赖
pnpm install --frozen-lockfile

# 4. 执行迁移
bash deploy/migrate.sh

# 5. 零停机发布
bash deploy/release.sh
```

升级前请阅读 `CHANGELOG.md`（如有）和迁移说明。涉及数据库结构变更时，先备份再迁移。

## 14. 数据库备份

```bash
bash deploy/backup.sh
```

默认输出到 `/www/backup/my2077/db-YYYYmmdd-HHMM.sql.gz`，保留 14 天。详细参数与恢复方式见 [README-BACKUP.md](../deploy/README-BACKUP.md)。

推荐加入定时任务：

```bash
crontab -e
```

```cron
15 3 * * * /www/wwwroot/my2077.com/deploy/backup.sh >> /var/log/my2077-backup.log 2>&1
```

恢复示例：

```bash
gzip -dc /www/backup/my2077/db-20260101-0315.sql.gz | mysql -u root my2077
```

## 15. 常见安装问题

| 现象 | 排查方向 |
| --- | --- |
| 构建报 Node 版本错误 | 使用 Node 24；确认 `node -v` 与 PM2 `interpreter` 一致 |
| `ER_ACCESS_DENIED_ERROR` | 检查 `.env` 中的用户、密码、host；确认 MySQL 用户授权到 `127.0.0.1` |
| 502 Bad Gateway | `pm2 status` 是否 online；`curl 127.0.0.1:3100` 是否 200；Nginx 端口是否一致 |
| 管理后台一直跳登录 | `users.is_admin` 是否为 1；是否重新登录；cookie 是否被 HTTPS 配置阻止 |
| 页面链接域名不对 | 修改 `NUXT_PUBLIC_SITE_URL` 后重启或重新发布 |
| 天气/GitHub 请求超时 | 检查服务器出网；Node 24 下保留 `NODE_OPTIONS=--no-network-family-autoselection` |
| 离线页一直出现 | 清理浏览器 Service Worker 与缓存，确认已部署最新 `sw.js` |

## 16. 安全清单

- `.env` 权限为 `600`，不提交到 Git。
- 数据库账号只授权本地 `127.0.0.1`。
- Nginx 覆盖 `X-Real-IP` 与 `X-Forwarded-For`。
- 使用 HTTPS，并设置 `NUXT_PUBLIC_SITE_URL` 为 HTTPS 地址。
- 定期执行数据库备份并验证可恢复。
- 不修改 `server/middleware/security.ts` 中的关键安全头，除非明确知道影响。
- 保留 `LICENSE`、`NOTICE`、`ADDITIONAL-TERMS.md` 与全站版权标记。
