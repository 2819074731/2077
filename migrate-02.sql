USE `my2077`;

-- 用户邮箱/短链查询已由唯一索引覆盖；补充会话与收录的常用查询索引
ALTER TABLE `sessions` ADD INDEX IF NOT EXISTS `idx_user_expires` (`user_id`, `expires_at`);
ALTER TABLE `submissions` ADD INDEX IF NOT EXISTS `idx_status_id` (`status`, `id`);
ALTER TABLE `user_links` ADD INDEX IF NOT EXISTS `idx_user_sort` (`user_id`, `sort`);
