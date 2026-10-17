-- 001_core_perf: 性能与数据基础结构（幂等，可重复执行）
-- 说明：所有 DDL 均通过 information_schema 判断后执行，避免 MySQL 不支持
-- ADD COLUMN IF NOT EXISTS 时重复执行报错。
SET @db := DATABASE();

-- submissions.access_token：投稿结果查询令牌
SET @has := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'access_token'
);
SET @ddl := IF(
  @has = 0,
  'ALTER TABLE `submissions` ADD COLUMN `access_token` VARCHAR(64) NULL AFTER `status`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'submissions' AND INDEX_NAME = 'idx_access_token'
);
SET @ddl := IF(
  @has = 0,
  'ALTER TABLE `submissions` ADD INDEX `idx_access_token` (`access_token`)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- submissions.url_key：URL 归一化（去尾部斜杠 + 小写），用于去重与精确匹配
SET @has := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'url_key'
);
SET @ddl := IF(
  @has = 0,
  'ALTER TABLE `submissions` ADD COLUMN `url_key` VARCHAR(500) GENERATED ALWAYS AS (LOWER(TRIM(TRAILING ''/'' FROM `url`))) STORED',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'submissions' AND INDEX_NAME = 'idx_url_key'
);
SET @ddl := IF(
  @has = 0,
  'ALTER TABLE `submissions` ADD INDEX `idx_url_key` (`url_key`(191))',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- directory_entries.url_key：与 submissions 保持一致的 URL 归一化
SET @has := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'directory_entries' AND COLUMN_NAME = 'url_key'
);
SET @ddl := IF(
  @has = 0,
  'ALTER TABLE `directory_entries` ADD COLUMN `url_key` VARCHAR(500) GENERATED ALWAYS AS (LOWER(TRIM(TRAILING ''/'' FROM `url`))) STORED',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'directory_entries' AND INDEX_NAME = 'idx_dir_url_key'
);
SET @ddl := IF(
  @has = 0,
  'ALTER TABLE `directory_entries` ADD INDEX `idx_dir_url_key` (`url_key`(191))',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 目录全文检索索引。优先使用 ngram 解析器以支持中文；
-- 若数据库没有启用 ngram（例如部分 MariaDB 版本），退化为默认解析器，
-- 仍然创建 FULLTEXT 索引，接口层会在检索异常时回退 LIKE。
SET @has_ngram := (
  SELECT COUNT(*) FROM information_schema.PLUGINS
  WHERE PLUGIN_NAME = 'ngram' AND PLUGIN_STATUS = 'ACTIVE'
);
SET @has_ft := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'directory_entries' AND INDEX_NAME = 'ft_directory_search'
);
SET @ddl := IF(
  @has_ft = 0,
  IF(
    @has_ngram > 0,
    'ALTER TABLE `directory_entries` ADD FULLTEXT INDEX `ft_directory_search` (`name`, `title`, `description`, `keywords`) WITH PARSER ngram',
    'ALTER TABLE `directory_entries` ADD FULLTEXT INDEX `ft_directory_search` (`name`, `title`, `description`, `keywords`)'
  ),
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 共享限流表：多进程/多实例下替代进程内 Map
CREATE TABLE IF NOT EXISTS `rate_limits` (
  `k` VARCHAR(191) NOT NULL,
  `count` INT NOT NULL DEFAULT 0,
  `reset_at` BIGINT NOT NULL,
  PRIMARY KEY (`k`),
  KEY `idx_reset_at` (`reset_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 目录列表组合索引：覆盖状态、精选、排序与分页
SET @has := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'directory_entries' AND INDEX_NAME = 'idx_dir_listing'
);
SET @ddl := IF(
  @has = 0,
  'ALTER TABLE `directory_entries` ADD INDEX `idx_dir_listing` (`status`, `featured`, `sort`, `id`)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 点击记录的 URL + 时间组合索引
SET @has := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'link_clicks' AND INDEX_NAME = 'idx_url_created'
);
SET @ddl := IF(
  @has = 0,
  'ALTER TABLE `link_clicks` ADD INDEX `idx_url_created` (`url`(191), `created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
