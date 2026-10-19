# 2077 导航文档

本目录面向部署者、开发者和二次开发者，说明项目的安装、配置、开发、架构与接口。

## 阅读顺序

| 文档 | 适用场景 |
| --- | --- |
| [INSTALLATION.md](INSTALLATION.md) | 从零部署到生产环境、升级、备份、排障 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 本地开发、代码结构、开发约定、测试与发布 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 了解请求链路、数据模型、缓存与安全设计 |
| [CONFIGURATION.md](CONFIGURATION.md) | 环境变量、站点设置、GitHub 代理、限流与版权配置 |
| [API.md](API.md) | 公开接口与后台接口概览 |
| [FAQ.md](FAQ.md) | 常见问题与快速排查 |

## 项目速览

- 技术栈：Nuxt 4 + Nitro `node-server` + MySQL + PM2 + Nginx
- 运行端口：默认 `127.0.0.1:3100`
- 健康检查：`GET /api/health`
- 管理后台：`/admin`，要求 `users.is_admin = 1`
- 许可：PolyForm Noncommercial License 1.0.0
- 版权：`Copyright (c) 2026 2077 Navigation (my2077.com)`

## 许可提醒

本项目允许非商业使用、修改与分发。任何分发或修改版本都必须保留：

- `LICENSE` 与 `NOTICE`
- 页面底部版权链接 https://my2077.com/
- 全站 meta、HTML 注释、响应头与 JSON-LD 中的版权与许可信息

商业使用需要单独授权，联系方式见 https://my2077.com/。
