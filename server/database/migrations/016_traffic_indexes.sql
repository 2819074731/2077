-- 流量后台按「日期 + 是否蜘蛛 + 维度」聚合，补充覆盖索引，避免大区间回表。
ALTER TABLE `traffic_log`
  ADD INDEX `idx_day_bot_path` (`day`, `is_bot`, `path`),
  ADD INDEX `idx_day_bot_ref` (`day`, `is_bot`, `referer`),
  ADD INDEX `idx_day_bot_device` (`day`, `is_bot`, `device`);
