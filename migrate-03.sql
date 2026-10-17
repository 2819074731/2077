-- migrate-03: 站点点击统计
USE `my2077`;

CREATE TABLE IF NOT EXISTS `link_clicks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `url` VARCHAR(500) NOT NULL,
  `name` VARCHAR(80) NOT NULL DEFAULT '',
  `user_id` INT NULL,
  `ip` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_url` (`url`(191)),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 聚合点击表：便于后台热门榜快速查询
CREATE TABLE IF NOT EXISTS `link_click_agg` (
  `url` VARCHAR(500) NOT NULL,
  `name` VARCHAR(80) NOT NULL DEFAULT '',
  `hits` INT NOT NULL DEFAULT 0,
  `last_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`url`(191)),
  KEY `idx_hits` (`hits`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
