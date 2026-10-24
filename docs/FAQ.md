# 常见问题

## 部署与运行

### 启动后访问 502

先确认 Nitro 是否正常：

```bash
pm2 status
curl -i http://127.0.0.1:3100/api/health
pm2 logs my2077-nav --lines 100
```

如果本机 `curl` 正常，检查 Nginx 的 `proxy_pass` 端口是否与 `PORT` 一致，以及 `server_name` 是否匹配。

### 构建时报 Node 版本不兼容

项目使用 Nuxt 4，推荐 Node 24。确认三处版本一致：

```bash
node -v
pnpm -v
pm2 describe my2077-nav | grep -i interpreter
```

`ecosystem.config.cjs` 中的 `interpreter` 指向服务器实际 Node 路径。

### 页面能打开，但数据库报错

检查 `.env` 与数据库连通性：

```bash
mysql -h 127.0.0.1 -u my2077 -p my2077 -e 'SELECT 1'
curl -s http://127.0.0.1:3100/api/health
```

常见原因：数据库用户只授权了 `localhost`、密码含特殊字符未加引号、数据库未导入 `schema.sql`。

### 后台一直跳回登录页

确认账号管理员标记：

```sql
SELECT id, email, is_admin FROM users WHERE email = '你的邮箱';
```

必要时更新：

```sql
UPDATE users SET is_admin = 1 WHERE email = '你的邮箱';
```

退出后重新登录。若使用 HTTPS，确认反向代理传了 `X-Forwarded-Proto`，否则安全 Cookie 可能不生效。

### 修改 `.env` 后没有生效

PM2 会缓存环境变量。修改后需要重启：

```bash
pm2 restart my2077-nav --update-env
```

使用发布脚本时，脚本会重新加载进程。

### 多实例下后台改了配置，前台要等几秒

站点设置与导航配置有 5 秒进程内缓存，目录缓存通过版本号失效。等待数秒或重载 PM2 即可。

### 发布脚本失败后站点异常

`deploy/release.sh` 会在健康检查失败时回滚到上一个产物。检查：

```bash
pm2 logs my2077-nav --lines 200
ls -lt /www/wwwroot/releases | head
```

必要时手动切回上一版本并重载。

## 数据与备份

### 如何备份

```bash
bash deploy/backup.sh
```

默认输出到 `/www/backup/my2077/`，保留 14 天。建议加入 crontab，并定期验证恢复。

### 如何恢复备份

```bash
gzip -dc /www/backup/my2077/db-YYYYmmdd-HHMM.sql.gz | mysql -u root my2077
```

恢复前先停止写入或进入维护状态，避免数据覆盖。

### 升级时要不要执行迁移

需要。流程是备份、拉代码、安装依赖、执行 `bash deploy/migrate.sh`、发布。迁移脚本记录在 `schema_migrations`，重复执行安全。

## 功能相关

### 首页天气一直失败

天气依赖外部服务与 IP 定位。检查服务器出网、DNS，以及 Node 是否保留：

```text
NODE_OPTIONS=--no-network-family-autoselection
```

也可以直接测试：

```bash
curl -s 'http://127.0.0.1:3100/api/weather?lat=30.27&lon=120.15'
```

### 图标不显示或一直是默认图

图标由 `/api/icon` 代理并缓存到 `data/icons/`。可能原因：

- 目标站点屏蔽抓取
- 图标超过大小限制
- 缓存了旧的失败结果

清理对应缓存或等待 7 天 TTL。后台可执行图标预热：

```bash
pnpm warm:icons
```

### 搜索没有结果

确认后台「引擎设置」已启用 GitHub 搜索，Token 未耗尽，服务器能访问 GitHub。必要时开启中转并检查中转健康状态。

### 提交收录提示已存在

同一规范化网址只能存在一条提交记录，且不能与目录已有条目重复。用 `/api/submit/check` 或提交页的检查功能确认状态。

### 目录详情页 404

详情页要求：

- `status = 'published'`
- `health_hidden = 0`
- `detail_enabled = 1`

后台检查该条目的详情开关与健康状态。

### 点击统计不增长

点击统计由前端上报 `/api/click`，需要：

- 请求体是合法的 `http/https` 网址
- 数据库可写
- 浏览器未拦截请求

热门目录按独立 IP 与日期去重，同一 IP 同一天多次点击只算一次。

### 热搜不更新

热搜有缓存与后台刷新入口。可在后台触发刷新，或等待缓存过期。外部源不可用时会回退到内置数据。

## PWA 与缓存

### 在线时仍显示离线页

项目已移除全局 `navigateFallback`，正常在线不会进入离线页。若仍出现：

1. 强制刷新页面。
2. 在浏览器开发者工具中注销 Service Worker。
3. 清理站点缓存后重新访问。

`public/sw-heal.js` 会在新 Service Worker 激活后修复停留在离线页的窗口。

### 更新后页面还是旧样式

Service Worker 与浏览器缓存可能保留旧资源。刷新一次或在开发者工具中勾选「绕过缓存」。发布新版本后 Service Worker 会自动更新。

## 开发相关

### `pnpm dev` 启动失败

检查 Node 与 pnpm 版本、端口占用、`.env` 是否存在。端口冲突时：

```bash
PORT=3001 pnpm dev
```

### 新增 composable 后 SSR 报未定义

清理构建缓存并显式导入：

```bash
rm -rf .nuxt node_modules/.cache/nuxt
pnpm dev
```

在组件中按需 `import`，避免依赖尚未生成的自动导入。

### 接口路径多了 `.get`

Nitro 文件路由会把 `nav.get.ts` 当成文件名的最后一段。多级路径请使用目录：

```text
server/api/admin/nav/index.get.ts  -> /api/admin/nav
```

### 自定义颜色加透明度无效

`--card`、`--accent` 等自定义 token 不支持 `bg-card/50` 语法。改用内置颜色、`color-mix` 或单独的 token。

### 手机端出现横向滚动

检查固定宽度、`100vw`、超长不换行文本与绝对定位元素。优先使用 `max-w-full`、`min-w-0` 与 `overflow-hidden`。

## 许可与版权

### 可以商用吗

可以。项目使用 AGPL-3.0-only，允许商业使用、修改与分发。通过网站、API 或其他网络服务向用户提供修改版时，必须按 AGPL 第 13 条提供完整对应源码。

### 部署后可以删除页脚版权吗

不可以。许可要求保留版权与许可声明。页脚可以调整样式，但应保留版权主体、许可名称，以及指向 https://my2077.com/ 的来源链接。

### 二次开发需要做什么

保留 `LICENSE` 与 `NOTICE`，分发时提供完整对应源码，向网络用户提供修改版时按第 13 条提供源码，标记修改过的文件，并按 `ADDITIONAL-TERMS.md` 第 7(b) 条在页脚、关于页或法律声明页展示：

> Based on 2077 Navigation (https://my2077.com). Modified by NAME on DATE.

同时遵守 `TRADEMARK.md`，不要使用项目名称或 Logo 暗示官方身份或背书。

### 为什么源码里看不到明文版权文案

版权文案在 `shared/copyright.ts` 中用分段 base64 保存，运行时解码。这样做的目的是降低被批量替换的概率，不包含任何自毁或运行时校验逻辑。

### 如何修改版权主体

统一修改 `shared/copyright.ts` 中的常量与 `LICENSE`、`NOTICE`、`ADDITIONAL-TERMS.md`、`TRADEMARK.md`、`package.json`、`README.md`。不要在各页面单独硬编码。修改后重新构建并发布。

### 为什么 F12 里能看到多处版权

版权同时写入 head meta、HTML 注释、响应头、JSON-LD、页脚与 `/license`，用于明确署名与许可范围。这些标记可以被移除，但移除后不再满足许可的保留要求。

## 安全与运维

### 如何限制后台访问

后台依赖账号与 `is_admin`，不提供独立入口保护。需要额外限制时，可在 Nginx 对 `/admin` 与 `/api/admin` 增加 IP 白名单或 Basic Auth。

### 收到了 CSP 报告

`/api/csp-report` 会接收浏览器的 CSP 违规报告。检查是否有新增内联脚本或第三方资源，必要时调整 `server/plugins/csp.ts` 的哈希与来源。

### 日志在哪里

```bash
pm2 logs my2077-nav
```

后台操作日志在 `admin_logs` 表，可在后台日志页查看。

### 如何确认当前版本

```bash
cd /www/wwwroot/my2077.com
git log -1 --oneline
pm2 describe my2077-nav | grep -E 'script path|exec cwd'
ls -lt /www/wwwroot/releases | head
```

线上产物目录名包含发布时间，便于对照发布记录。
