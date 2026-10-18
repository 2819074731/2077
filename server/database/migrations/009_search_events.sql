-- 搜索行为统计：记录搜索引擎、关键词与来源（热搜词/手动输入）。
CREATE TABLE IF NOT EXISTS `search_events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `engine` VARCHAR(32) NOT NULL,
  `term` VARCHAR(120) NOT NULL,
  `kind` VARCHAR(16) NOT NULL DEFAULT 'input',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_created` (`created_at`),
  KEY `idx_engine_created` (`engine`, `created_at`),
  KEY `idx_term_created` (`term`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
