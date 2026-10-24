# 2077 导航

可自定义的浏览器起始页与网站目录。黑白 Monochrome 设计，本地优先，离线可用，登录后云端同步。

- 线上站点：https://my2077.com
- 许可说明：https://my2077.com/license
- 源码仓库：https://gitea.com/qiqius/2077

## 功能

### 起始页

- 自定义分组与链接，本地保存，登录后同步到云端
- 按分类切换首页内容，分类栏与手机抽屉共用同一套 SPA 状态
- 推荐位由站长维护，常用站点按点击时间衰减独立排序，支持置顶与隐藏
- 多搜索引擎切换、自定义引擎、输入网址回车直达
- 热评信息栏、天气（IP 定位与城市切换）、必应壁纸与显示效果预设
- PWA 离线访问、添加到主屏幕、系统分享目标

### 搜索与目录

- 站内搜索 GitHub 仓库、用户、Issue 与代码文件
- 独立的分类网站目录，支持分面筛选、详情页、热门榜与收录状态查询
- 前台提交收录，自动抓取 TDK 与图标，后台人工审核
- 死链巡检、自动隐藏、链接发现、sitemap 批量导入

### 账号与后台

- 邮箱/用户名 + 密码登录，QQ 号绑定与默认头像
- 个人资料、修改密码、退出其他设备、公开主页 `/u/{id}`
- 收藏夹、云端导航同步、导入导出 JSON
- 管理后台 `/admin`：概览、收录审核、导航管理、分类目录、分类管理、链接发现、友情链接、用户管理、流量与蜘蛛统计、搜索分析、引擎设置、操作日志、网站设置

### 运维与 SEO

- 动态 sitemap、robots、HTML 站点地图、`llms.txt`、JSON-LD、canonical
- 全站版权与许可标记，响应头、HTML 注释、meta、JSON-LD、页脚多位置覆盖
- 安全响应头、CSP、限流、SSRF 防护、会话哈希、scrypt 密码哈希
- PM2 cluster + 原子切换产物的零停机发布脚本

## 技术栈

- Nuxt 4（Vue 3 + Nitro `node-server`）
- Tailwind CSS 与 CSS 变量设计令牌
- MySQL 8 / MariaDB 10.11（`mysql2`）
- PM2 cluster、Nginx 反向代理
- `@vite-pwa/nuxt`、`@nuxtjs/sitemap`、`@nuxtjs/robots`、`@nuxtjs/color-mode`

## 快速开始

```bash
# 安装依赖
pnpm install

# 复制环境变量模板并填写数据库与站点地址
cp .env.example .env

# 初始化数据库（先创建库和账号）
mysql -u my2077 -p my2077 < schema.sql

# 执行增量迁移
bash deploy/migrate.sh

# 启动开发服务器
pnpm dev
```

默认开发地址为 `http://localhost:3000`。生产环境请参考完整的安装文档。

## 文档

- [文档索引](docs/README.md)
- [安装部署](docs/INSTALLATION.md)
- [开发指南](docs/DEVELOPMENT.md)
- [架构说明](docs/ARCHITECTURE.md)
- [配置参考](docs/CONFIGURATION.md)
- [接口概览](docs/API.md)
- [常见问题](docs/FAQ.md)
- [路线图](docs/ROADMAP.md)

## 目录结构

```text
app/                      # Nuxt 前端（srcDir）
  components/             # 通用组件
  composables/            # 导航、认证、设备、壁纸、设置等状态
  layouts/                # 前台与后台布局
  middleware/             # 后台鉴权
  pages/                  # 页面路由
  plugins/                # 客户端插件
  utils/                  # 前端工具
server/                   # Nitro 服务端
  api/                    # 接口路由
  database/migrations/    # 增量 SQL
  middleware/             # 安全、统计、版权响应头
  plugins/                # CSP、巡检、内存守卫、版权注入
  routes/                 # 非 /api 路由（llms.txt）
  utils/                  # 数据库、认证、抓取、缓存、设置等
shared/                   # 前后端共用类型、默认数据、版权常量
public/                   # 静态资源
deploy/                   # 初始化、迁移、备份、Nginx、零停机发布
scripts/                  # 迁移、备份、图标预热脚本
tests/                    # 冒烟测试
```

## 生产部署

```bash
# 安装依赖并构建
pnpm install --frozen-lockfile
pnpm build

# 使用 PM2 启动（读取同目录 .env）
pm2 start ecosystem.config.cjs
pm2 save
```

推荐使用 `deploy/release.sh` 做零停机发布：在临时目录构建、预检新版本、原子切换 `.output`、平滑重载 PM2，失败自动回滚。

## 许可与版权

本项目采用 **GNU Affero General Public License v3.0 only（AGPL-3.0-only）** 发布，允许商业使用、修改与分发。

- 许可说明：https://my2077.com/license
- 官方全文：https://www.gnu.org/licenses/agpl-3.0.html
- 附加条款：https://gitea.com/qiqius/2077/blob/main/ADDITIONAL-TERMS.md
- 商标政策：https://gitea.com/qiqius/2077/blob/main/TRADEMARK.md

通过网站、API 或其他网络服务向用户提供修改版时，必须按 AGPL 第 13 条提供完整对应源码，并按第 7(b) 条在页脚、关于页或法律声明页保留可点击来源标注：

> Based on 2077 Navigation (https://my2077.com). Modified by NAME on DATE.

分发源码或目标代码时，必须按 AGPL 提供完整对应源码，并保留 `LICENSE`、`NOTICE` 中的版权与许可信息。原版页脚版权链接指向 https://my2077.com/，请勿移除或改写。
