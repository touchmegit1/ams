-- Upgrade an existing AMS database created from the older schema.sql.
-- Run once; this migration preserves all existing courses and curriculum rows.
ALTER TABLE courses
    ADD COLUMN course_code VARCHAR(32) NULL,
    ADD COLUMN subject VARCHAR(120) NULL,
    ADD COLUMN target_audience VARCHAR(200) NULL,
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    MODIFY COLUMN status ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT';

CREATE UNIQUE INDEX uk_courses_course_code ON courses (course_code);
