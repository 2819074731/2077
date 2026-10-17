-- 002_drop_unused_ft: 数据库未启用 ngram 时，默认解析器的 FULLTEXT 无法检索中文，
-- 接口层会回退 LIKE。移除该索引，避免无意义的写入开销。
SET @db := DATABASE();
SET @has_ngram := (
  SELECT COUNT(*) FROM information_schema.PLUGINS
  WHERE PLUGIN_NAME = 'ngram' AND PLUGIN_STATUS = 'ACTIVE'
);
SET @has_ft := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'directory_entries' AND INDEX_NAME = 'ft_directory_search'
);
SET @ddl := IF(
  @has_ft > 0 AND @has_ngram = 0,
  'ALTER TABLE `directory_entries` DROP INDEX `ft_directory_search`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
