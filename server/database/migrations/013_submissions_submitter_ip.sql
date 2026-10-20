-- 提交收录：记录提交人 IP，供后台审核与风险排查。
SET @db := DATABASE();

SET @has := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'submitter_ip'
);
SET @ddl := IF(
  @has = 0,
  'ALTER TABLE `submissions` ADD COLUMN `submitter_ip` VARCHAR(64) NOT NULL DEFAULT '''' AFTER `user_id`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
