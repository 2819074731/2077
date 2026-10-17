ALTER TABLE directory_entries
  ADD COLUMN province VARCHAR(40) NOT NULL DEFAULT '' AFTER category,
  ADD COLUMN city VARCHAR(40) NOT NULL DEFAULT '' AFTER province,
  ADD COLUMN school_level VARCHAR(20) NOT NULL DEFAULT '' AFTER city,
  ADD COLUMN school_type VARCHAR(20) NOT NULL DEFAULT '' AFTER school_level,
  ADD COLUMN supervisor VARCHAR(60) NOT NULL DEFAULT '' AFTER school_type,
  ADD INDEX idx_dir_province (category, province, id);
