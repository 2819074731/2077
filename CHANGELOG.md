# 变更记录

## 1.0.0 - 未发布

首个公开源码版本，功能范围以 README 与 `docs/ROADMAP.md` 为准。

- 许可证切换为 AGPL-3.0-only，新增 `ADDITIONAL-TERMS.md` 与 `TRADEMARK.md`
- 版权与来源信息同步到响应头、页面、JSON-LD、`humans.txt` 与 `llms.txt`
- 最低 Node.js 版本提升到 24.22.1，修复 Brotli 解码越界写（CVE-2026-111497）等 2026 年 10 月安全公告问题
- 发布脚本在 pnpm 版本切换时跳过交互式依赖目录清理，支持无人值守发布
