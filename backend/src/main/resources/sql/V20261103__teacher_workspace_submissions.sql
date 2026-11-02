-- Apply once to an existing AMS schema. This migration preserves existing submissions.
ALTER TABLE submissions
    ADD COLUMN original_file_name VARCHAR(255) NULL,
    ADD COLUMN teacher_feedback TEXT NULL,
    ADD COLUMN reviewed_at TIMESTAMP NULL;

CREATE INDEX idx_submissions_assignment_student_date
    ON submissions (assignment_id, student_id, submitted_at);
