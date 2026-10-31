-- Run only when Hibernate ddl-auto=update has not already added these columns.
ALTER TABLE assignments
  ADD COLUMN assignment_type VARCHAR(20) DEFAULT 'DOCUMENT',
  ADD COLUMN questions_json LONGTEXT NULL;
