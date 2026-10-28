# 变更记录

## 1.0.0 - 未发布

首个公开源码版本，功能范围以 README 与 `docs/ROADMAP.md` 为准。

- 许可证切换为 AGPL-3.0-only，新增 `ADDITIONAL-TERMS.md` 与 `TRADEMARK.md`
- 版权与来源信息同步到响应头、页面、JSON-LD、`humans.txt` 与 `llms.txt`
- 最低 Node.js 版本提升到 24.22.1，修复 Brotli 解码越界写（CVE-2026-111497）等 2026 年 10 月安全公告问题
- 发布脚本在 pnpm 版本切换时跳过交互式依赖目录清理，支持无人值守发布
- 新增站内搜索：`/search` 页面、首页站内/全网切换、即时联想、公开收藏搜索、拼音全拼与首字母匹配、关键词高亮
- 新增站内搜索分析：结果数、耗时、点击率、零结果词，以及后台拼音索引状态与全量重建
- 新增 `pinyin-pro` 依赖，用于目录名称的拼音别名索引
- 新增 Google站内搜索：`/google`页面、后台可配 SearXNG/CSE中转线路、线路健康探测与短 TTL缓存
- 后台引擎设置拆分为 GitHub与 Google两套配置，支持线路增删排序与一键测速
- 重做运营流量后台：区间切换、浏览/蜘蛛/点击趋势、24小时分时、热门页面、来源、设备、蜘蛛抓取路径与搜索概览
- 流量接口改为并行查询并加30秒私有缓存；补充 `traffic_log`组合索引（`016_traffic_indexes.sql`）
- 蜘蛛 UA识别扩充（YisouSpider、Amazonbot、DataForSeoBot、Headless等），埋点路径改为白名单
- Google中转支持访问令牌（`relayToken`），请求带 `Authorization: Bearer`，测速同样生效
- 新增 `deploy/nginx-searx-relay.conf`参考配置：自建 SearXNG的 HTTP跳转、ACME验证、令牌鉴权与 `/healthz`
- 文档补充自建 SearXNG中转的证书与令牌注意事项
