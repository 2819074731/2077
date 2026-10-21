-- 提交收录：记录提交人 IP 归属地，便于后台审核与风险排查。
SET @db := DATABASE();

SET @has := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'submitter_location'
);
SET @ddl := IF(
  @has = 0,
  'ALTER TABLE `submissions` ADD COLUMN `submitter_location` VARCHAR(191) NOT NULL DEFAULT '''' AFTER `submitter_ip`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
