-- migrate-04: 支持用户名登录（账号名与邮箱二选一）
USE `my2077`;

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `username` VARCHAR(60) NULL AFTER `email`;
ALTER TABLE `users` ADD UNIQUE KEY IF NOT EXISTS `uniq_username` (`username`);
