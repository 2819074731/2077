-- migrate-06: 站点元数据缓存 + 链接健康检查
USE `my2077`;

CREATE TABLE IF NOT EXISTS `meta_cache` (
  `url_hash` CHAR(40) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `host` VARCHAR(255) NOT NULL DEFAULT '',
  `title` VARCHAR(200) NOT NULL DEFAULT '',
  `description` TEXT NULL,
  `keywords` VARCHAR(300) NOT NULL DEFAULT '',
  `icon` VARCHAR(500) NOT NULL DEFAULT '',
  `fetched_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`url_hash`),
  KEY `idx_fetched` (`fetched_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `link_health` (
  `url_hash` CHAR(40) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `status` SMALLINT NOT NULL DEFAULT 0,
  `final_url` VARCHAR(500) NULL,
  `checked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`url_hash`),
  KEY `idx_checked` (`checked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
