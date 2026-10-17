# 2077 导航

可自定义的浏览器起始页。黑白 Monochrome 设计，本地优先，离线可用，登录后云端同步。

## 功能

- **自定义导航**：分组与链接的增删改，本地保存，登录后同步到云端
- **推荐 / 常用**：推荐站点置顶，常用站点按点击习惯自动排序
- **搜索直达**：内置多搜索引擎（默认必应），支持自定义搜索引擎，输入网址回车直达
- **天气**：按访问 IP 自动定位（清秋 IP 接口），支持手动切换城市
- **站点图标**：服务端 `/api/icon` 代理，多级回退（站点 favicon → Google s2 → DuckDuckGo → favicon.im），7 天缓存
- **提交收录**：一键抓取站点 TDK（title / description / keywords）与图标，提交后由后台审核
- **管理后台** `/admin`：概览、收录审核、导航管理、用户管理（响应式，适配手机与 PC）
- **PWA**：离线可用，可添加到主屏幕

## 技术栈

- Nuxt 4 全栈（Nitro `node-server`）
- Tailwind CSS 4 + 黑白 Monochrome 令牌（`--glim-*` 体系）
- MySQL（`mysql2`）
- `@vite-pwa/nuxt`、`@nuxtjs/sitemap`、`@nuxtjs/robots`、`@nuxtjs/color-mode`

## 目录结构

```
app/
  app.vue                 # 根组件，套用 layout
  layouts/
    default.vue           # 前台布局（头部、页脚、抽屉）
    admin.vue             # 后台布局（侧栏 + 响应式）
  components/
    SearchBar.vue         # 搜索框（内置引擎切换 + 自定义）
    WeatherCard.vue       # 天气（compact 模式用于头部）
    FrequentLinks.vue     # 推荐 / 常用
    LinkGroup.vue         # 分组
    LinkItem.vue          # 链接项（记录点击频次）
    AppDrawer.vue         # 手机抽屉菜单
  composables/
    useNav.ts             # 导航数据、频次、引擎、云端同步
    useAuth.ts            # 登录态
  middleware/
    admin.ts              # 后台鉴权
  pages/
    index.vue             # 首页
    submit.vue            # 提交收录
    login.vue / register.vue / settings.vue
    u/[name].vue          # 用户公开主页
    admin/                # 后台页面
  data/nav.ts             # 内置引擎、推荐站点、默认分组
server/
  api/                    # 接口（auth / config / links / meta / submit / icon / weather / admin）
  utils/                  # db / auth / site / weather / settings / siteGroups
  schema.sql / migrate-*.sql
```

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

## 构建与部署

```bash
# 构建
pnpm build

# 使用 pm2 启动（读取同目录 .env 注入环境变量）
pm2 start ecosystem.config.cjs
pm2 save
```

生产环境需要 `.env`（参考 `.env.example`），Nginx 反代到 `127.0.0.1:3100`。

## 环境变量

见 `.env.example`。`ecosystem.config.cjs` 会在启动时读取同目录 `.env`，不会把密钥提交到仓库。

## 数据库

首次部署执行 `schema.sql`，后续变更执行 `migrate-*.sql`。
