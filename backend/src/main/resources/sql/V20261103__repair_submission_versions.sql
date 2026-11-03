-- MySQL: preserve existing rows and add the version columns expected by Hibernate.
-- Safe to run again. Existing legacy columns are deliberately retained.
SET @ams_sql = IF((SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'assignments' AND column_name = 'version') = 0,
    'ALTER TABLE assignments ADD COLUMN version BIGINT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE ams_stmt FROM @ams_sql;
EXECUTE ams_stmt;
DEALLOCATE PREPARE ams_stmt;
UPDATE assignments SET version = 0 WHERE version IS NULL;

SET @ams_sql = IF((SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'submissions' AND column_name = 'submission_version') = 0,
    'ALTER TABLE submissions ADD COLUMN submission_version BIGINT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE ams_stmt FROM @ams_sql;
EXECUTE ams_stmt;
DEALLOCATE PREPARE ams_stmt;
UPDATE submissions SET submission_version = 0 WHERE submission_version IS NULL;

-- Đảm bảo các bài tập tài liệu hiện có cho phép nộp các tệp phổ biến nếu allowed_file_types đang null/rỗng
UPDATE assignments SET allowed_file_types = 'PDF,DOC,DOCX,ZIP,TXT'
WHERE (allowed_file_types IS NULL OR TRIM(allowed_file_types) = '') AND (assignment_type IS NULL OR assignment_type = 'DOCUMENT');

-- Đảm bảo attempt_number có giá trị mặc định nếu tồn tại (tránh lỗi Field 'attempt_number' doesn't have a default value)
SET @ams_sql = IF((SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'submissions' AND column_name = 'attempt_number') > 0,
    'ALTER TABLE submissions MODIFY COLUMN attempt_number INT DEFAULT 1', 'SELECT 1');
PREPARE ams_stmt FROM @ams_sql;
EXECUTE ams_stmt;
DEALLOCATE PREPARE ams_stmt;

-- Đảm bảo status và ai_evaluation_status nhận được mọi trạng thái hợp lệ
SET @ams_sql = IF((SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'submissions' AND column_name = 'status') > 0,
    'ALTER TABLE submissions MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT ''SUBMITTED''', 'SELECT 1');
PREPARE ams_stmt FROM @ams_sql;
EXECUTE ams_stmt;
DEALLOCATE PREPARE ams_stmt;

SET @ams_sql = IF((SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'submissions' AND column_name = 'ai_evaluation_status') > 0,
    'ALTER TABLE submissions MODIFY COLUMN ai_evaluation_status VARCHAR(30) DEFAULT ''NOT_REQUIRED''', 'SELECT 1');
PREPARE ams_stmt FROM @ams_sql;
EXECUTE ams_stmt;
DEALLOCATE PREPARE ams_stmt;
