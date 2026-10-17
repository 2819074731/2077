USE `my2077`;

SET @has_qq := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'my2077' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'qq'
);
SET @ddl := IF(
  @has_qq = 0,
  'ALTER TABLE `users` ADD COLUMN `qq` VARCHAR(20) NULL AFTER `avatar`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_qq_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'my2077' AND TABLE_NAME = 'users' AND INDEX_NAME = 'uniq_qq'
);
SET @ddl := IF(
  @has_qq_idx = 0,
  'ALTER TABLE `users` ADD UNIQUE KEY `uniq_qq` (`qq`)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
