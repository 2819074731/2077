# 路线图

本文件记录版本范围与发布门槛，避免功能规划和开源准备脱节。

## 当前版本

- 状态：维护中
- 范围：起始页、导航同步、分类目录、收录审核、管理后台、SEO、PWA、零停机发布
- 许可：GNU Affero General Public License v3.0 only（AGPL-3.0-only，允许商业使用）

## 下一版本：站内搜索引擎

- 状态：开发中（MariaDB + pinyin-pro 版本已完成，Meilisearch 索引待接入）
- 目标：为目录、导航条目和公开收藏提供独立、可排序、可分析的站内搜索
- 不包含：全网爬虫、独立网页索引、AI 问答

### 功能范围

1. 独立 `/search` 页面，支持关键词、分类、分页和排序
2. 首页搜索框增加“站内 / 全网”切换
3. 即时联想、最近搜索、热门搜索、关键词高亮
4. 中文分词、拼音与首字母、同义词、错别字容忍
5. 排序权重：标题精确匹配、名称、关键词、描述、精选、点击量、更新时间
6. 过滤：仅 `status = published` 且 `health_hidden = 0`
7. 搜索分析：零结果词、点击率、结果数、耗时
8. 后台索引管理：全量重建、增量同步、状态查看

### 技术方案

- 首选 Meilisearch 单节点，索引 `directory_entries`、`submissions`、公开的 `user_links`
- Nuxt 服务端代理搜索请求，Meilisearch 仅监听 `127.0.0.1`
- 后台新增、编辑、上下架、删除时触发增量同步
- 每日低峰全量重建，失败自动回退旧索引
- 数据量较小时允许先用现有 MariaDB LIKE 查询过渡，接口契约保持不变

### 验收标准

- 常用关键词首屏响应低于 500ms，P95 低于 1s
- 中文、英文、数字、拼音首字母均可命中
- 搜索“百度”“baidu”“bd”能返回同一条目
- 零结果页提供可点击的推荐词
- 索引同步延迟低于 60s，全量重建可重复执行
- 搜索接口具备限流、超时和降级

### 交付物

- 搜索接口与索引同步脚本
- 前端搜索页、联想组件和首页切换
- Meilisearch 部署与备份文档
- 单元测试、接口测试和搜索质量样例集
- 版本变更说明

## 开源发布门槛

下一版本发布前必须全部满足：

- [x] 建立公开 Git 仓库，README 中的仓库地址可访问
- [x] 明确许可证：采用 AGPL-3.0-only，并同步 README、LICENSE、NOTICE、ADDITIONAL-TERMS、TRADEMARK、页面版权与 `package.json`
- [x] 仓库不包含 `.env`、`/data/`、`node_modules/`、`.output/`、`.nuxt/`、日志和部署机专属文件
- [x] 移除一次性运维脚本，或移动到 `scripts/` 并补充说明
- [ ] 根目录 `migrate-*.sql` 与 `server/database/migrations/` 只保留一套权威迁移
  - 阻塞：`schema.sql` 目前只有 6 张基础表，`directory_entries`、`link_clicks`、`link_click_agg`、`meta_cache`、`link_health`、`traffic_log` 仍依赖根目录旧迁移；先补 `000_base_tables.sql` 或完整 `schema.sql`，再删除旧文件
- [x] `package.json` 增加 `version`、`packageManager`、`engines`
- [x] CI 覆盖单元测试、类型检查和生产构建
- [ ] 生成版本标签和发布说明（CHANGELOG 已建立）
- [x] 从干净目录按 README 完成一次全新安装与构建
- [ ] 检查第三方依赖、字体、图标和截图的许可
