-- 后台操作日志：记录导航/目录分类同步等高风险变更，便于审计与回滚定位。
CREATE TABLE IF NOT EXISTS `admin_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL DEFAULT 0,
  `username` VARCHAR(60) NOT NULL DEFAULT '',
  `action` VARCHAR(40) NOT NULL,
  `target` VARCHAR(191) NOT NULL DEFAULT '',
  `detail` JSON NULL,
  `ip` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_logs_created` (`created_at`),
  KEY `idx_admin_logs_action` (`action`, `created_at`),
  KEY `idx_admin_logs_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
