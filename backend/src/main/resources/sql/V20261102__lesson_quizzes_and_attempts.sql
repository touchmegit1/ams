-- Run once against an existing AMS MySQL database. Back up the database first.
-- This migration preserves existing assignments and submissions.
ALTER TABLE assignments
    ADD COLUMN lesson_id INT NULL AFTER course_id,
    ADD INDEX idx_assignments_lesson (lesson_id, status),
    ADD CONSTRAINT fk_assignments_lesson
        FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE SET NULL;

CREATE TABLE quiz_attempts (
    attempt_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    student_id INT NOT NULL,
    answers_json LONGTEXT NOT NULL,
    score DECIMAL(7,2) NOT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quiz_attempt_assignment FOREIGN KEY (assignment_id)
        REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    CONSTRAINT fk_quiz_attempt_student FOREIGN KEY (student_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_quiz_attempt_student_assignment (student_id, assignment_id)
);
