-- Additive Teacher Workspace analytics migration.
-- Back up the database, then run once on an existing AMS MySQL schema.
-- This migration preserves current course, enrollment, assignment and quiz data.
CREATE TABLE lesson_progress (
    progress_id BIGINT NOT NULL AUTO_INCREMENT,
    student_id INT NOT NULL,
    lesson_id INT NOT NULL,
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (progress_id),
    CONSTRAINT uk_lesson_progress_student_lesson UNIQUE (student_id, lesson_id),
    CONSTRAINT fk_lesson_progress_student FOREIGN KEY (student_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_lesson_progress_lesson FOREIGN KEY (lesson_id)
        REFERENCES lessons(lesson_id) ON DELETE CASCADE,
    KEY idx_lesson_progress_lesson (lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
