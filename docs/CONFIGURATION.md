# 配置参考

本文说明环境变量、站点设置、GitHub 代理、限流、安全头与版权配置。

## 1. 环境变量

生产环境由 `ecosystem.config.cjs` 读取同目录 `.env`，也可以通过系统环境变量覆盖。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NUXT_DB_HOST` | `127.0.0.1` | MySQL 主机 |
| `NUXT_DB_PORT` | `3306` | MySQL 端口 |
| `NUXT_DB_USER` | `my2077` | 数据库用户 |
| `NUXT_DB_PASS` | 空 | 数据库密码 |
| `NUXT_DB_NAME` | `my2077` | 数据库名 |
| `NUXT_SESSION_SECRET` | `change-me` | 会话密钥，必须替换 |
| `NUXT_PUBLIC_SITE_URL` | `https://my2077.com` | 站点绝对地址 |
| `PORT` | `3100` | Nitro 监听端口 |
| `HOST` | `127.0.0.1` | Nitro 监听地址 |
| `NODE_OPTIONS` | `--no-network-family-autoselection` | 避免 Node 选择不可用的 IPv6 路由 |
| `BAIDU_PUSH_TOKEN` | 空 | 百度搜索主动推送 token |
| `GITHUB_TOKEN` | 空 | GitHub API Token 兜底 |
| `GITHUB_TOKENS` | 空 | 多个 GitHub Token，逗号分隔轮询 |
| `GITHUB_SEARCH_RELAYS` | 内置列表 | GitHub 搜索中转兜底 |
| `GOOGLE_SEARCH_RELAYS` |空 | Google搜索中转兜底，逗号分隔，只接受 https |

说明：

- Nuxt runtimeConfig 在运行时会把 `NUXT_DB_*` 映射到 `dbHost`、`dbPort` 等字段。
- `DB_HOST`、`DB_PORT` 等变量主要用于构建期默认值和迁移脚本兼容。
- `.env` 不应提交到 Git，权限建议 `600`。
- 修改 `NUXT_PUBLIC_SITE_URL` 后需要重启或重新发布。

## 2. 站点设置

站点设置保存在 `settings` 表的 `site_settings` 键中，通过后台「网站设置」修改。主要字段：

| 字段 | 说明 |
| --- | --- |
| `siteName` | 站点名称 |
| `siteShortName` | 短名称，用于图标 |
| `siteTagline` | 副标题 |
| `siteDescription` | SEO 描述 |
| `siteKeywords` | SEO 关键词 |
| `homeLineMode` | 首页信息栏：`stats` 或 `comment` |
| `submitDefaultTarget` | 默认收录位置：`nav` 或 `directory` |
| `submitAllowNav` | 是否允许提交到首页导航 |
| `submitAllowDirectory` | 是否允许提交到分类目录 |
| `submitReviewDays` | 审核时长说明 |
| `submitNotice` | 提交页提示 |
| `directoryPageSize` | 目录每页条数 |
| `maintenanceSchedule` | 每日巡检时间，格式 `HH:mm` |
| `linkTtlDays` | 死链巡检间隔天数 |
| `tdkTtlDays` | TDK 缓存天数 |
| `icpNumber` | ICP 备案号 |
| `contactEmail` | 联系邮箱 |
| `footerLinks` | 页脚导航入口数组，每项包含 `label` 与 `url`，最多 8 个；`url` 支持站内 `/` 路径或 `http(s)://` 链接，空数组则隐藏页脚导航 |

其他配置键：

| 键 | 说明 |
| --- | --- |
| `site_config` | 首页导航分组与推荐位 |
| `site_categories` | 全局分类列表 |
| `friend_links` | 友情链接 |
| `directory_cache_version` | 目录缓存版本号 |
| `directory_maintenance_last` | 最近巡检结果 |

## 3. GitHub 设置

后台「引擎设置」可以配置 GitHub 搜索与下载行为：

| 字段 | 说明 |
| --- | --- |
| `enabled` | 是否启用 GitHub 站内搜索 |
| `defaultSort` | 默认排序：`best`、`stars`、`forks`、`updated` |
| `pageSize` / `maxPages` | 分页大小与最大页数 |
| `showReadme` | 是否显示 README |
| `showIssues` / `showPulls` / `showReleases` | 是否显示 Issue、PR、Release |
| `showCommits` / `showContributors` / `showRefs` | 是否显示提交、贡献者、分支 |
| `enableZip` | 是否允许下载源码 ZIP |
| `enableReleaseDownload` | 是否允许下载 Release 资产 |
| `maxZipMB` / `maxAssetMB` / `rawMaxMB` | 单文件大小上限 |
| `antiHotlink` | 是否开启防盗链 |
| `allowEmptyReferer` | 是否允许空 Referer |
| `refererWhitelist` | Referer 白名单 |
| `assetTtlSec` / `repoCacheSec` / `readmeCacheSec` | 资源与仓库缓存时间 |
| `imageMaxMB` / `imageRatePerMin` | 图片大小与每分钟请求上限 |
| `searchCacheSec` | 搜索结果缓存时间 |
| `searchFallback` | GitHub 失败时是否启用中转 |
| `searchRelays` | 中转地址列表，最多 6 个 |

GitHub Token 推荐在后台维护，后台配置优先于环境变量。每个 Token 独立计算额度，未配置时匿名额度较低。中转只用于搜索与下载兜底，不会把 Token 发送给第三方。

## 4. Google 搜索设置

后台「引擎设置」的 Google页签配置站内 Google搜索（`/google`）。默认没有内置中转，需自行填写可用线路。

|字段 |说明 |
| --- | --- |
| `enabled` |是否启用 Google站内搜索，关闭后接口返回503 |
| `pageSize` / `maxPages` |每页条数（10到30）与最大页数（1到10） |
| `language` |搜索语言，默认 `zh-CN` |
| `safeSearch` |是否过滤成人内容 |
| `cacheSec` |结果缓存时间（60到3600秒） |
| `timeoutMs` |单条线路超时（2000到15000毫秒） |
| `relays` |中转地址，最多6条，只接受 https，按顺序尝试 |
| `relayToken` |可选的中转访问令牌，非空时请求带 `Authorization: Bearer <token>`；8到200位，可用 `A-Za-z0-9._~+/=-` |

中转地址支持两种写法：

- SearXNG实例根地址，例如 `https://searx.example.com`，服务端自动拼 `/search?q=%s&format=json&pageno=N`。实例需在 `settings.yml`的 `search.formats`中保留 `json`，否则会返回 HTML或403。
-带占位符的自定义地址，例如 Google CSE：`https://www.googleapis.com/customsearch/v1?key=KEY&cx=CX&q=%s&start=%start%`。

可用占位符：`%s`（关键词，已编码）、`%pageno%`、`%start%`、`%lang%`、`%pagesize%`。

返回体支持 JSON（SearXNG的 `results`、CSE的 `items`、`organic`、`data`、`web.results`）与 HTML（h3锚点、`result` class、`<h2>`邻近回退）。所有线路都失败时接口返回502。

后台「测速」按钮会并行探测所有线路（`/api/admin/google-relay-health`），按可用性与耗时排序，绿色徽标表示当前可用。

### 4.1 自建 SearXNG中转

公共 SearXNG实例普遍有速率限制或人机挑战，长期使用建议自建。要点：

1. `settings.yml`中 `search.formats`需包含 `json`，并保持 `public_instance: false`。
2.中转域名必须是**公网可访问的 https**：`isHttpRelay`会拒绝含凭据的地址，内网/回环地址也会被拒绝。
3.用 Nginx反代并校验令牌，令牌与后台 `relayToken`保持一致：

```nginx
location / {
 if ($http_authorization != "Bearer <与后台一致的令牌>") {
 return401;
 }
 proxy_pass http://127.0.0.1:8081;
}
```

4. TLS证书必须覆盖中转域名本身。签发后可先用 `curl -s -o /dev/null -w '%{http_code}' https://<域名>/healthz`验证为 `200`；若返回 `000`，通常是证书 SAN不匹配导致校验失败。

仓库内 `deploy/nginx-searx-relay.conf`是一份可直接参考的完整配置（HTTP跳转 + ACME验证 +令牌鉴权 + `/healthz`）。


## 5. 限流

限流由 `server/utils/rateLimit.ts` 提供，生产环境使用 `rate_limits` 表共享计数，数据库异常时回退进程内限流。主要接口：

| 接口 | 限制 |
| --- | --- |
| 登录 | 每 IP 10 次/分钟，每账号 20 次/10 分钟 |
| 注册 | 每 IP 5 次/小时 |
| 提交收录 | 每 IP 10 次/10 分钟 |
| 提交预检查 | 每 IP 30 次/分钟 |
| 搜索事件 | 每 IP 60 次/分钟 |
| 搜索结果 | 每 IP 120 次/分钟 |
| TDK 抓取 | 每 IP 120 次/分钟 |
| GitHub 搜索 | 每 IP 40 次/分钟 |
| GitHub 下载 | 每 IP 15 次/分钟 |
| Google搜索 |每 IP30次/分钟 |
| Google线路测速 |管理员每 IP10次/分钟 |
| CSP 报告 | 每 IP 30 次/分钟 |

限流依赖 Nginx 正确写入 `X-Real-IP` 与 `X-Forwarded-For`。

## 6. 安全响应头

`server/middleware/security.ts` 设置：

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cross-Origin-Opener-Policy: same-origin`
- HTTPS 下自动添加 HSTS
- 生产环境 CSP，脚本哈希由 `server/plugins/csp.ts` 动态计算

修改安全头前请确认不会破坏 PWA、内联 JSON-LD 或第三方图片。

## 7. 版权与许可配置

版权常量位于 `shared/copyright.ts`，包含：

- `owner`：2077 导航
- `site`：my2077.com
- `zh` / `en`：中英文版权行
- `license`：GNU Affero General Public License v3.0 only（AGPL-3.0-only）
- `licenseShort` / `spdx`：AGPL-3.0-only
- `licenseUrl`：https://my2077.com/license
- `official`：https://www.gnu.org/licenses/agpl-3.0.html
- `source` / `termsUrl` / `trademarkUrl`：源码、附加条款与商标政策地址
- `notice` / `required`：许可说明与保留声明

版权展示位置：

| 位置 | 文件 |
| --- | --- |
| 全局 head、html 属性 | `nuxt.config.ts` |
| 全局 JSON-LD | `app/app.vue` |
| HTML 注释 | `server/plugins/copyright.ts` |
| 响应头 | `server/middleware/copyright.ts` |
| 前台与后台页脚 | `app/components/CopyrightBar.vue` |
| 许可页 | `app/pages/license.vue` |
| 文本入口 | `public/humans.txt`、`server/routes/llms.txt.ts` |

原版页脚版权链接固定指向 https://my2077.com/。部署或修改版本时不要移除或改写该链接；二次开发版本还需按 `ADDITIONAL-TERMS.md` 增加来源标注。

## 8. PWA 与缓存

- Service Worker 由 `@vite-pwa/nuxt` 生成。
- 页面导航使用 `NetworkFirst`，失败回退 `/offline`。
- 公开接口 `site`、`categories`、`hot-search`、`friends` 使用 `NetworkFirst`。
- 图标使用 `CacheFirst`，缓存 30 天。
- 修改 PWA 配置后，旧 Service Worker 需要刷新一次或注销后更新。

## 9. SEO 配置

- `nuxt.config.ts` 中配置 `site.url`、`site.name`、`site.description`。
- `sitemap.sources` 指向 `/api/__sitemap__/urls`。
- `robots.disallow` 排除登录、设置、后台与 API。
- 页面使用 `useSeoMeta` 与 `useHead` 设置标题、描述、canonical 与 JSON-LD。

## 10. 运行期目录

| 目录 | 说明 |
| --- | --- |
| `data/icons/` | 图标缓存，已在 `.gitignore` 中排除 |
| `/www/backup/my2077/` | 默认数据库备份目录 |
| `/www/wwwroot/releases/` | 零停机发布的历史产物 |

运行期目录不要提交到仓库，也不要随意删除正在使用的版本。
