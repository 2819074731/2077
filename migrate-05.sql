-- migrate-05: 用户头像（客户端压缩后的 data URL，最大 ~200KB）
USE `my2077`;

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `avatar` MEDIUMTEXT NULL AFTER `nickname`;
