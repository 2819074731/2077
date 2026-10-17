USE `my2077`;

SET @has_detail := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'my2077' AND TABLE_NAME = 'directory_entries' AND COLUMN_NAME = 'detail_enabled'
);
SET @ddl := IF(
  @has_detail = 0,
  'ALTER TABLE `directory_entries` ADD COLUMN `detail_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `status`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
