-- 记录站内搜索耗时，便于分析首屏响应与慢查询。
ALTER TABLE `search_events`
  ADD COLUMN `took_ms` INT NULL DEFAULT NULL AFTER `results`;
