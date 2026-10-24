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
| [ROADMAP.md](ROADMAP.md) | 版本范围与开源发布门槛 |

## 项目速览

- 技术栈：Nuxt 4 + Nitro `node-server` + MySQL + PM2 + Nginx
- 运行端口：默认 `127.0.0.1:3100`
- 健康检查：`GET /api/health`
- 管理后台：`/admin`，要求 `users.is_admin = 1`
- 许可：GNU Affero General Public License v3.0 only（AGPL-3.0-only）
- 版权：`Copyright (c) 2026 2077 Navigation (my2077.com)`

## 许可提醒

本项目允许商业使用、修改与分发。任何分发或通过网络提供服务的修改版本都必须：

- 保留 `LICENSE` 与 `NOTICE`，以及全站 meta、HTML 注释、响应头与 JSON-LD 中的版权与许可信息
- 分发时按 AGPL 提供完整对应源码；通过网络提供服务时按第 13 条向用户提供源码
- 按 `ADDITIONAL-TERMS.md` 第 7(b) 条保留可点击来源标注：`Based on 2077 Navigation (https://my2077.com)`
- 遵守 `TRADEMARK.md`，不得暗示官方身份或背书

原版页面底部版权链接指向 https://my2077.com/，请勿移除或改写。
