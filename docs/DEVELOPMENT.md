# 开发指南

本文面向本地开发和二次开发，说明环境搭建、代码结构、开发约定、测试与发布流程。

## 1. 本地环境

| 组件 | 版本 |
| --- | --- |
| Node.js | 24.x 推荐 |
| pnpm | 10.x |
| MySQL | 8.0+ 或 MariaDB 10.11+ |

```bash
corepack enable
corepack prepare pnpm@10 --activate

git clone https://gitea.com/qiqius/2077.git
cd 2077
pnpm install
cp .env.example .env
```

在 `.env` 中配置数据库：

```dotenv
NUXT_DB_HOST=127.0.0.1
NUXT_DB_PORT=3306
NUXT_DB_USER=my2077
NUXT_DB_PASS=你的密码
NUXT_DB_NAME=my2077
NUXT_SESSION_SECRET=随机字符串
NUXT_PUBLIC_SITE_URL=http://localhost:3000
```

初始化数据库：

```bash
mysql -u my2077 -p my2077 < schema.sql
bash deploy/migrate.sh
```

启动开发服务器：

```bash
pnpm dev
```

默认地址为 `http://localhost:3000`。

## 2. 常用脚本

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动 Nuxt 开发服务器 |
| `pnpm build` | 构建生产产物到 `.output/` |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm generate` | 生成静态站点（本项目主要使用 node-server，不常用） |
| `pnpm test:smoke` | 对运行中的站点执行冒烟测试 |
| `pnpm warm:icons` | 预热站点图标缓存 |
| `bash deploy/migrate.sh` | 执行数据库迁移 |
| `bash deploy/release.sh` | 零停机发布 |
| `bash deploy/backup.sh` | 备份数据库 |

冒烟测试默认访问 `https://my2077.com`，本地测试请指定 `BASE_URL`：

```bash
BASE_URL=http://127.0.0.1:3000 pnpm test:smoke
```

## 3. 目录结构

```text
app/
  app.vue                    # 根组件，挂载 layout 与全局 head
  assets/css/tailwind.css    # Tailwind 入口与设计令牌
  components/                # 通用组件
  composables/               # 组合式状态：导航、认证、设备、壁纸、设置
  layouts/
    default.vue              # 前台布局：头部、页脚、抽屉、版权栏
    admin.vue                # 后台布局：侧栏、顶部栏、版权栏
  middleware/admin.ts        # 后台路由鉴权
  pages/                     # 文件路由
  plugins/                   # 客户端插件
  utils/                     # 前端工具
server/
  api/                       # Nitro 接口路由
  database/migrations/       # 增量 SQL
  middleware/                # 安全头、统计、版权响应头
  plugins/                   # CSP、版权注释、巡检、内存守卫、预热
  routes/                    # 非 /api 路由，如 llms.txt
  utils/                     # 数据库、认证、抓取、缓存、设置
shared/                      # 前后端共用类型、默认站点、分类、版权常量
public/                      # favicon、Service Worker 辅助文件、humans.txt
deploy/                      # 初始化、迁移、备份、Nginx、发布脚本
scripts/                     # 迁移、备份、图标预热
tests/                       # 冒烟测试
```

## 4. 请求链路

```text
浏览器
  -> Nginx（TLS、X-Real-IP、X-Forwarded-For）
  -> Nitro node-server（127.0.0.1:3100）
  -> 页面 SSR / API handler
  -> server/utils
  -> MySQL
```

- 页面请求由 Nuxt SSR 渲染，客户端 hydration 后接管交互。
- 接口请求由 `server/api/**` 中的文件路由处理。
- 服务端工具统一放在 `server/utils/`，通过自动导入或相对路径使用。
- 前后端共用数据放在 `shared/`，使用 `#shared/...` 引用。

## 5. 新增页面

在 `app/pages/` 下创建 `.vue` 文件即可生成路由：

```text
app/pages/example.vue          -> /example
app/pages/example/index.vue    -> /example
app/pages/example/[id].vue     -> /example/:id
```

后台页面需要声明后台布局和鉴权中间件：

```ts
definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})
```

页面 SEO 使用 `useSeoMeta` 与 `useHead`，需要 canonical 时同时设置：

```ts
const siteUrl = useRuntimeConfig().public.siteUrl

useSeoMeta({
  title: '页面标题',
  description: '页面描述',
  ogUrl: siteUrl + '/example'
})

useHead(() => ({
  link: [{ rel: 'canonical', href: siteUrl + '/example' }]
}))
```

## 6. 新增接口

接口文件放在 `server/api/`，文件名决定 HTTP 方法与路径：

```text
server/api/example.get.ts     -> GET  /api/example
server/api/example.post.ts    -> POST /api/example
server/api/example/[id].get.ts -> GET /api/example/:id
```

基础写法：

```ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const db = useDb()
  const [rows] = await db.query('SELECT 1')
  return { ok: true }
})
```

后台接口必须校验管理员：

```ts
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  await rateLimit(event, 'admin-example', 60, 60_000)
  const body = await readBody(event)
  await logAdmin(event, user, 'update', 'example', '说明')
  return { ok: true }
})
```

路由命名注意：

- `server/api/admin/nav.get.ts` 会注册成 `/api/admin/nav.get`。
- 多级路径请使用目录：`server/api/admin/nav/index.get.ts` 才是 `/api/admin/nav`。
- 移动文件后，相对 import 的层级需要同步调整。

## 7. 数据与设置

### MySQL 表

| 表 | 用途 |
| --- | --- |
| `users` | 账号、昵称、头像、QQ、管理员标记、云端配置 |
| `sessions` | 登录会话，数据库存哈希后的 token |
| `user_links` | 用户云端链接 |
| `submissions` | 收录提交与审核状态 |
| `settings` | 键值配置，JSON 存储 |
| `search_events` | 搜索行为统计 |
| `directory_entries` | 分类目录条目 |
| `link_clicks` / `link_click_agg` | 导航点击与聚合统计 |
| `rate_limits` | 数据库共享限流 |
| `admin_logs` | 后台操作日志 |
| `schema_migrations` | 迁移执行记录 |

### 设置在 `settings` 中的键

| 键 | 内容 |
| --- | --- |
| `site_settings` | 站点名称、SEO、提交设置、GitHub 设置等 |
| `site_config` | 首页导航分组与推荐位 |
| `site_categories` | 全局分类列表 |
| `directory_cache_version` | 目录缓存版本号 |
| `directory_maintenance_last` | 最近一次巡检记录 |
| `friend_links` | 友情链接 |

修改这些配置后，多实例部署需要等待缓存 TTL 或重启/重载进程。

### 浏览器本地存储

主要键名以 `my2077.` 开头，例如：

- `my2077.wallpaper.*`：壁纸与显示效果
- `my2077.freq.*`：常用站点与置顶/隐藏
- `my2077.weather.cache`：天气缓存
- `my2077.search.*`：搜索历史与最近使用

## 8. 认证与权限

- 密码使用 `scrypt` 哈希，格式为 `scrypt$salt$hash`。
- 登录成功后写入 `sid` Cookie，数据库只保存 token 的 SHA-256 哈希。
- 会话有效期 30 天，可通过「退出其他设备」撤销。
- 后台权限只认 `users.is_admin = 1`，路由中间件与服务端 `requireAdmin` 双重校验。
- 登录、注册、提交、搜索等接口使用 `rateLimit` 限流，生产环境走数据库共享限流。

## 9. 样式与设备适配

- 设计令牌定义在 `app/assets/css/tailwind.css`，如 `--bg`、`--card`、`--text`、`--accent`。
- 自定义颜色 token 不支持 Tailwind 的 `/opacity` 修饰，半透明请使用内置颜色或 `color-mix`。
- 设备判定统一使用 `useDevice()`，按 UA 区分 PC 与手机；不要新增手动「电脑版/手机版」开关。
- 后台与前台都要检查手机端无横向溢出。
- 图标统一使用 `SiteIcon.vue`，避免裸 `<img>` 缺少失败回退。

## 10. 版权与许可约定

版权文案集中在 `shared/copyright.ts`，用分段 base64 保存并在运行时解码。

- 页面与组件只引用 `COPYRIGHT`，不要硬编码新的版权字符串。
- 全站版权覆盖位置：
  - `nuxt.config.ts` 的 `app.head`
  - `server/plugins/copyright.ts` 的 SSR HTML 注释
  - `server/middleware/copyright.ts` 的响应头
  - `app/app.vue` 的 JSON-LD
  - `app/components/CopyrightBar.vue` 的页脚
  - `public/humans.txt`、`/license`、`/llms.txt`
- 底部版权链接固定指向 `https://my2077.com/`，不要改成部署者自己的站点。
- 不添加自毁、崩溃或运行时删除版权的校验逻辑。

修改版权信息时，同步更新 `LICENSE`、`NOTICE`、`package.json` 和 `README.md`。

## 11. 测试

```bash
# 先启动本地服务
pnpm dev

# 另一个终端执行
BASE_URL=http://127.0.0.1:3000 pnpm test:smoke
```

测试覆盖首页、目录、sitemap、公开设置、分类、健康检查、提交预检查、安全响应头、版权标记、热门目录、热搜、搜索事件与后台鉴权。

提交前建议至少执行：

```bash
pnpm build
BASE_URL=http://127.0.0.1:3000 pnpm test:smoke
```

## 12. 发布流程

1. 本地修改并自测。
2. 提交源码并推送到 `main`。
3. 服务器拉取或上传源码。
4. 依赖变化时执行 `pnpm install --frozen-lockfile`。
5. 有数据库变更时执行 `bash deploy/migrate.sh`。
6. 执行 `bash deploy/release.sh`。
7. 验证 `/`、`/license`、`/api/health` 与关键后台页面。

```bash
bash deploy/release.sh
pm2 status
curl -s http://127.0.0.1:3100/api/health
```

发布脚本会保留历史版本，失败自动回滚。

## 13. 常见开发问题

| 问题 | 原因与处理 |
| --- | --- |
| 新增 composable 后 SSR 报未定义 | 清理 `.nuxt` 与 `node_modules/.cache/nuxt`，组件内显式 import |
| 页面 500 | 先 `curl 127.0.0.1:3100/` 查看 JSON `message`，再看 PM2 日志 |
| 天气请求 `ETIMEDOUT` | Node 的 IPv6 自动选择问题，保留 `NODE_OPTIONS=--no-network-family-autoselection` |
| 后台改配置不生效 | 多实例缓存 TTL 或未调用缓存失效；等待 5 秒或重载进程 |
| Service Worker 一直返回离线页 | 检查 `navigateFallback` 配置与 `public/sw-heal.js`，清理浏览器旧缓存 |
| 构建后静态文件 404 | 重新构建；Nitro manifest 会记录 `public/` 文件 |
| 自定义颜色半透明失效 | 不要用 `bg-card2/50`，改用内置颜色或 `color-mix` |
| 接口路径出现 `.get` | 多级路由使用目录结构，参考第 6 节 |
| 本地 Node 版本不符 | 使用 Node 24，并确认 `pnpm` 使用同一版本 |

## 14. 开发约定

- 使用 TypeScript，跟随现有代码风格。
- 只在必要处添加注释，解释原因而不是重复代码。
- 服务端输入必须校验，外部抓取必须限制协议、私网地址、响应大小与超时。
- 后台写操作尽量记录 `admin_logs`。
- 新增数据库变更使用编号迁移文件，避免直接改 `schema.sql` 而不提供迁移。
- 不提交 `.env`、数据库密码、Token 或运行时 `data/` 目录。
- 分发或部署时保留版权与许可信息。
