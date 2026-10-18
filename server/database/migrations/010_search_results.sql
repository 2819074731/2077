-- 记录站内 GitHub 搜索的结果数，便于发现无结果搜索词。
ALTER TABLE `search_events`
  ADD COLUMN `results` INT NULL DEFAULT NULL AFTER `kind`,
  ADD KEY `idx_results_created` (`results`, `created_at`);
