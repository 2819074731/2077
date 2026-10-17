USE `my2077`;

SET @has_target := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'my2077' AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'target'
);
SET @ddl := IF(
  @has_target = 0,
  'ALTER TABLE `submissions` ADD COLUMN `target` VARCHAR(20) NOT NULL DEFAULT ''nav'' AFTER `grp`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `directory_entries` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `icon` VARCHAR(500) NOT NULL DEFAULT '',
  `category` VARCHAR(60) NOT NULL DEFAULT '其他',
  `title` VARCHAR(200) NOT NULL DEFAULT '',
  `description` VARCHAR(500) NOT NULL DEFAULT '',
  `keywords` VARCHAR(300) NOT NULL DEFAULT '',
  `content` TEXT NULL,
  `featured` TINYINT(1) NOT NULL DEFAULT 0,
  `sort` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'published',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_url` (`url`(191)),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_featured` (`featured`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `traffic_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `day` DATE NOT NULL,
  `path` VARCHAR(255) NOT NULL,
  `visitor` CHAR(40) NOT NULL,
  `ip_hash` CHAR(40) NOT NULL,
  `ua` VARCHAR(300) NOT NULL DEFAULT '',
  `is_bot` TINYINT(1) NOT NULL DEFAULT 0,
  `bot` VARCHAR(40) NOT NULL DEFAULT '',
  `device` VARCHAR(12) NOT NULL DEFAULT '',
  `referer` VARCHAR(255) NOT NULL DEFAULT '',
  `status` SMALLINT NOT NULL DEFAULT 200,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_day` (`day`),
  KEY `idx_bot_day` (`is_bot`, `day`),
  KEY `idx_visitor_day` (`visitor`, `day`),
  KEY `idx_path_day` (`path`, `day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
