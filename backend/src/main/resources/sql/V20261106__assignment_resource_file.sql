-- Add metadata for uploaded assignment resources without changing existing assignments.
SET @ams_sql = IF((SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'assignments' AND column_name = 'resource_file_key') = 0,
    'ALTER TABLE assignments ADD COLUMN resource_file_key VARCHAR(80) NULL', 'SELECT 1');
PREPARE ams_stmt FROM @ams_sql;
EXECUTE ams_stmt;
DEALLOCATE PREPARE ams_stmt;

SET @ams_sql = IF((SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'assignments' AND column_name = 'resource_file_name') = 0,
    'ALTER TABLE assignments ADD COLUMN resource_file_name VARCHAR(255) NULL', 'SELECT 1');
PREPARE ams_stmt FROM @ams_sql;
EXECUTE ams_stmt;
DEALLOCATE PREPARE ams_stmt;
