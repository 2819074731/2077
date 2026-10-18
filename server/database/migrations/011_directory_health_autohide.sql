-- 连续探测失败后自动从目录列表隐藏，恢复后自动回归。
ALTER TABLE `directory_entries`
  ADD COLUMN `health_fail_count` INT NOT NULL DEFAULT 0 AFTER `checked_at`,
  ADD COLUMN `health_hidden` TINYINT NOT NULL DEFAULT 0 AFTER `health_fail_count`,
  ADD KEY `idx_health_hidden` (`status`, `health_hidden`);
