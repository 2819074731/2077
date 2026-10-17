ALTER TABLE directory_entries
  ADD INDEX idx_dir_category_status (category, status, id);
