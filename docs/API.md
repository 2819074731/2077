# API 参考

本文列出站点公开接口与后台接口。接口由 Nitro 文件路由生成，统一前缀 `/api`。

## 1. 通用约定

### 请求与响应

- 请求与响应均为 JSON，`Content-Type: application/json`。
- 时间字段为 MySQL 返回的字符串或 ISO 时间。
- 分页参数从 `1` 开始，服务端会限制最大页大小。
- 公开数据接口带 `Cache-Control`，写接口不缓存。

### 错误格式

```json
{
  "statusCode": 400,
  "statusMessage": "请填写站点名称",
  "stack": []
}
```

生产环境默认不返回堆栈。客户端应以 `statusCode` 判断，`statusMessage` 仅用于提示。

### 认证

- 登录成功后服务端设置 `sid` Cookie，`httpOnly`、`sameSite=lax`。
- 浏览器请求同源接口会自动携带 Cookie。
- 后台接口要求 `users.is_admin = 1`，否则返回 `403`。
- 未登录返回 `401`。

### 限流

超过限制返回 `429`。常用限制见 [CONFIGURATION.md](./CONFIGURATION.md#4-限流)。

## 2. 公开接口

### 站点与配置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查。本机或管理员可见详细内存与磁盘信息 |
| GET | `/api/site` | 首页导航配置，含分组与推荐 |
| GET | `/api/site/settings` | 公开站点设置 |
| GET | `/api/categories` | 分类列表 |
| GET | `/api/friends` | 友情链接 |
| GET | `/api/hot-search?engine=bing` | 热搜，`engine` 支持 `bing` 等 |
| GET | `/api/home/comment?exclude=...` | 随机网易云热评，`exclude` 避免重复 |
| GET | `/api/wallpaper?n=8` | 随机壁纸，`n` 范围 1-16 |
| GET | `/api/wallpaper/image?id=...` | 壁纸图片代理 |
| GET | `/api/weather?lat=&lon=` | 天气；不传坐标时按 IP 定位 |
| GET | `/api/weather/city?city=杭州` | 按城市名查询天气 |
| GET | `/api/icon?url=example.com` | 站点图标代理与缓存 |

### 分类目录

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/directory` | 目录分页列表 |
| GET | `/api/directory/all?limit=5000` | 全量轻量列表，最大 5000 |
| GET | `/api/directory/popular?days=7&limit=8` | 热门目录，`days` 1-30，`limit` 1-12 |
| GET | `/api/directory/{id}` | 目录详情，包含相关推荐、上一篇、下一篇 |

`/api/directory` 查询参数：

| 参数 | 说明 |
| --- | --- |
| `page` | 页码，默认 1 |
| `size` | 每页数量，默认 24，最大 48 |
| `category` | 分类 |
| `province` | 省份 |
| `q` | 关键词，2 个字符以上优先使用全文索引 |
| `featured` | 传 `1` 只看推荐 |
| `level` | 高校层次 |
| `type` | 高校类型 |
| `sort` | `recommended`、`latest`、`name` |

响应：

```json
{
  "items": [],
  "total": 0,
  "all": 0,
  "categories": [],
  "provinces": [],
  "levels": [],
  "types": [],
  "sort": "recommended",
  "page": 1,
  "size": 24
}
```

### 搜索

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/search/result` | 回填 GitHub 搜索结果数量 |
| POST | `/api/search/event` | 记录搜索词，供热搜统计 |

搜索行为只统计引擎为 `github` 的请求。

### GitHub 代理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/github/search?q=&page=&sort=` | 仓库搜索，`sort` 支持 `best`、`stars`、`forks`、`updated` |
| GET | `/api/google/search?q=&page=` |站内 Google搜索，走后台配置的中转线路 |
| GET | `/api/github/repo?owner=&repo=` | 仓库信息 |
| GET | `/api/github/readme?owner=&repo=` | README |
| GET | `/api/github/contents?owner=&repo=&path=` | 目录内容 |
| GET | `/api/github/issue?owner=&repo=&number=` | Issue 或 PR |
| GET | `/api/github/release?owner=&repo=` | Release |
| GET | `/api/github/user?name=` | 用户信息 |
| GET | `/api/github/explore` | 探索列表 |
| GET | `/api/github/raw?owner=&repo=&path=&ref=` | 原始文件 |
| GET | `/api/github/image?owner=&repo=&path=&ref=` | 图片代理 |
| GET | `/api/github/download?owner=&repo=&ref=&path=` | 源码或文件下载 |

这些接口受后台 GitHub 设置与限流控制。未启用 GitHub 搜索时返回 `403`。

### 提交收录

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/submit/check` | 检查网址是否已提交或已收录 |
| POST | `/api/submit` | 提交收录 |
| GET | `/api/submit/status?token=` | 按 token 查询；登录用户可查最近 20 条 |

`POST /api/submit` 会记录提交人 IP（`submitter_ip`），并通过 `api.hk0.cc/api/ip` 解析归属地（`submitter_location`），仅在后台提交列表中展示。归属地查询失败不影响提交。请求体：

```json
{
  "name": "站点名称",
  "url": "https://example.com",
  "icon": "https://example.com/favicon.ico",
  "title": "标题",
  "description": "描述",
  "keywords": "关键词",
  "group": "分类",
  "target": "nav",
  "_trap": ""
}
```

`target` 为 `nav` 或 `directory`。`_trap` 是蜜罐字段，填写后服务端静默成功。

### 用户与账号

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | 注册，需邮箱、密码、QQ 号 |
| POST | `/api/auth/login` | 登录，`account` 可用邮箱或用户名 |
| POST | `/api/auth/logout` | 退出当前会话 |
| GET | `/api/me` | 当前用户与公开链接 |
| PUT | `/api/account/profile` | 修改昵称、用户名、头像、QQ |
| PUT | `/api/account/password` | 修改密码，撤销其他会话 |
| DELETE | `/api/account/sessions` | 退出其他设备 |
| GET | `/api/config` | 获取当前用户云端导航配置 |
| PUT | `/api/config` | 保存云端导航配置 |
| PUT | `/api/links` | 保存个人公开链接，最多 50 条 |
| GET | `/api/u/{name}` | 用户公开主页，`name` 为 ID 或 slug |

注册请求体：

```json
{
  "email": "user@example.com",
  "username": "user",
  "password": "至少 8 位",
  "qq": "10001",
  "nickname": "昵称"
}
```

`PUT /api/config` 请求体：

```json
{
  "groups": [],
  "freq": {},
  "freqAt": {},
  "freqMeta": { "pin": [], "hide": [] },
  "bookmarks": []
}
```

### 统计与其他

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/click` | 记录导航点击 |
| POST | `/api/meta` | 抓取网址 TDK 与图标 |
| POST | `/api/csp-report` | 接收 CSP 违规报告 |
| GET | `/api/__sitemap__/urls` | 动态 sitemap 数据源 |
| GET | `/llms.txt` | AI 抓取说明 |

`POST /api/click` 请求体：

```json
{ "url": "https://example.com", "name": "示例" }
```

`POST /api/meta` 请求体：

```json
{ "url": "https://example.com" }
```

## 3. 后台接口

所有后台接口都要求管理员登录。路径以 `/api/admin` 开头。

### 站点配置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/nav` | 获取导航配置 |
| PUT | `/api/admin/nav` | 保存导航配置，并同步目录 |
| GET | `/api/admin/nav/export` | 导出导航 JSON |
| POST | `/api/admin/nav/import` | 导入导航 JSON |
| GET | `/api/admin/site-settings` | 获取站点设置 |
| PUT | `/api/admin/site-settings` | 保存站点设置 |
| GET | `/api/admin/engine-settings` | 获取 GitHub 设置 |
| PUT | `/api/admin/engine-settings` | 保存 GitHub 设置 |
| GET | `/api/admin/friends` | 获取友情链接 |
| PUT | `/api/admin/friends` | 保存友情链接 |

### 分类与目录

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/categories` | 分类及使用量 |
| POST | `/api/admin/categories` | `add`、`rename`、`delete`、`sort` |
| POST | `/api/admin/category-sync/preview` | 分类同步预览 |
| GET | `/api/admin/directory` | 目录管理列表 |
| POST | `/api/admin/directory` | `save`、`delete`、`status`、`featured`、`bulk` |
| POST | `/api/admin/directory/tdk` | 重新抓取 TDK |
| POST | `/api/admin/directory/check-links` | 检查死链 |
| POST | `/api/admin/directory/health` | 目录健康状态 |
| POST | `/api/admin/discover` | 发现候选站点 |
| POST | `/api/admin/maintenance` | 手动触发巡检 |

### 提交审核

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/submissions?status=` | 提交列表 |
| POST | `/api/admin/submissions` | 审核、修改、删除提交 |

审核请求示例：

```json
{
  "id": 123,
  "action": "approve",
  "targets": { "nav": true, "directory": true },
  "category": "工具"
}
```

### 用户、统计与日志

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/users` | 用户列表 |
| POST | `/api/admin/users` | `toggle-admin`、`delete` |
| GET | `/api/admin/stats` | 概览统计 |
| GET | `/api/admin/clicks` | 点击明细 |
| GET | `/api/admin/traffic` | 流量统计 |
| GET | `/api/admin/search-stats` | 搜索统计 |
| GET | `/api/admin/logs` | 后台操作日志 |
| GET | `/api/admin/health` | 系统健康 |
| POST | `/api/admin/health/check` | 主动健康检查 |
| POST | `/api/admin/seo/push` | 推送 URL 到搜索引擎 |
| GET | `/api/admin/github-tokens` | Token 列表 |
| POST | `/api/admin/github-tokens` | 添加 Token |
| DELETE | `/api/admin/github-tokens` | 删除 Token |
| POST | `/api/admin/github-relay-health` | 检查 GitHub 中转 |
| POST | `/api/admin/google-relay-health` |检查 Google中转可用性与耗时 |
| POST | `/api/admin/hot-search-refresh` | 刷新热搜 |
| GET | `/api/admin/hot-search-status` | 热搜状态 |

## 4. 调用示例

```bash
# 健康检查
curl -s http://127.0.0.1:3100/api/health

# 目录第一页
curl -s 'http://127.0.0.1:3100/api/directory?page=1&size=12&category=工具'

# 登录并保存 Cookie
curl -s -c /tmp/cookies.txt -H 'Content-Type: application/json' \
  -d '{"account":"admin@example.com","password":"你的密码"}' \
  http://127.0.0.1:3100/api/auth/login

# 使用 Cookie 获取后台设置
curl -s -b /tmp/cookies.txt http://127.0.0.1:3100/api/admin/site-settings
```

## 5. 变更注意

- 接口返回字段会在小版本内保持兼容，新增字段视为兼容变更。
- 后台接口路径与参数可能随功能调整，二次开发请以代码为准。
- 所有新增接口必须包含输入校验、必要的限流与权限检查。
