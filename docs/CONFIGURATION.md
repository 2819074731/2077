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

## 4. 限流

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
| CSP 报告 | 每 IP 30 次/分钟 |

限流依赖 Nginx 正确写入 `X-Real-IP` 与 `X-Forwarded-For`。

## 5. 安全响应头

`server/middleware/security.ts` 设置：

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cross-Origin-Opener-Policy: same-origin`
- HTTPS 下自动添加 HSTS
- 生产环境 CSP，脚本哈希由 `server/plugins/csp.ts` 动态计算

修改安全头前请确认不会破坏 PWA、内联 JSON-LD 或第三方图片。

## 6. 版权与许可配置

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

## 7. PWA 与缓存

- Service Worker 由 `@vite-pwa/nuxt` 生成。
- 页面导航使用 `NetworkFirst`，失败回退 `/offline`。
- 公开接口 `site`、`categories`、`hot-search`、`friends` 使用 `NetworkFirst`。
- 图标使用 `CacheFirst`，缓存 30 天。
- 修改 PWA 配置后，旧 Service Worker 需要刷新一次或注销后更新。

## 8. SEO 配置

- `nuxt.config.ts` 中配置 `site.url`、`site.name`、`site.description`。
- `sitemap.sources` 指向 `/api/__sitemap__/urls`。
- `robots.disallow` 排除登录、设置、后台与 API。
- 页面使用 `useSeoMeta` 与 `useHead` 设置标题、描述、canonical 与 JSON-LD。

## 9. 运行期目录

| 目录 | 说明 |
| --- | --- |
| `data/icons/` | 图标缓存，已在 `.gitignore` 中排除 |
| `/www/backup/my2077/` | 默认数据库备份目录 |
| `/www/wwwroot/releases/` | 零停机发布的历史产物 |

运行期目录不要提交到仓库，也不要随意删除正在使用的版本。
