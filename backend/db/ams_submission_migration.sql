-- Additive UC5 migration. Back up ams_db, then run this once against the existing schema.
-- Existing submission rows and their legacy status values are preserved.
ALTER TABLE submissions
    MODIFY COLUMN status VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED',
    MODIFY COLUMN ai_feedback LONGTEXT NULL,
    ADD COLUMN attempt_number INT NOT NULL DEFAULT 1,
    ADD COLUMN rubric_snapshot LONGTEXT NULL,
    ADD COLUMN evaluation_error VARCHAR(1000) NULL,
    ADD COLUMN teacher_feedback TEXT NULL,
    ADD COLUMN teacher_reviewed_at DATETIME NULL,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

UPDATE submissions SET status = 'EVALUATED' WHERE status = 'AI_EVALUATED';

CREATE INDEX idx_submission_assignment_student_attempt
    ON submissions (assignment_id, student_id, attempt_number);
CREATE INDEX idx_submission_assignment_status
    ON submissions (assignment_id, status);

CREATE TABLE submission_files (
    file_id INT NOT NULL AUTO_INCREMENT,
    submission_id INT NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    storage_key VARCHAR(80) NOT NULL,
    media_type VARCHAR(120) NULL,
    size_bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (file_id),
    UNIQUE KEY uk_submission_files_storage_key (storage_key),
    KEY idx_submission_files_submission (submission_id),
    CONSTRAINT fk_submission_files_submission FOREIGN KEY (submission_id)
        REFERENCES submissions(submission_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
