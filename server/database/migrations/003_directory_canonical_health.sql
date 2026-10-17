ALTER TABLE directory_entries
  ADD COLUMN canonical_key VARCHAR(500) GENERATED ALWAYS AS (
    LOWER(TRIM(TRAILING '/' FROM REGEXP_REPLACE(REGEXP_REPLACE(url, '^https?://', ''), '^www\\.', '')))
  ) STORED,
  ADD UNIQUE KEY uniq_canonical (canonical_key),
  ADD COLUMN http_status INT NULL,
  ADD COLUMN final_url VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN checked_at DATETIME NULL,
  ADD COLUMN tdk_checked_at DATETIME NULL;
