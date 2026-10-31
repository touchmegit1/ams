-- MySQL: run ONCE against the existing schema.sql database, BEFORE starting the
-- updated application. This script does not drop databases or existing data.
-- Do not run after Hibernate ddl-auto=update has already added these columns.
ALTER TABLE users MODIFY role ENUM('STUDENT','TEACHER','ADMIN') NOT NULL DEFAULT 'STUDENT';

CREATE TABLE assignment_templates (
  template_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  course_id INT NULL,
  description TEXT NOT NULL,
  default_max_score DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  default_rubric TEXT NOT NULL,
  created_by INT NOT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assignment_template_course FOREIGN KEY (course_id) REFERENCES courses(course_id),
  CONSTRAINT fk_assignment_template_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
);

ALTER TABLE assignments
  ADD COLUMN status ENUM('DRAFT','PUBLISHED','CLOSED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN source ENUM('MANUAL','AI','TEMPLATE') NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN template_id INT NULL,
  ADD COLUMN allowed_file_types VARCHAR(100) NULL,
  ADD COLUMN created_by INT NULL,
  ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT fk_assignment_template FOREIGN KEY (template_id) REFERENCES assignment_templates(template_id),
  ADD CONSTRAINT fk_assignment_creator FOREIGN KEY (created_by) REFERENCES users(user_id);

UPDATE assignments a JOIN courses c ON c.course_id = a.course_id
SET a.created_by = c.teacher_id, a.updated_at = COALESCE(a.created_at, CURRENT_TIMESTAMP);
CREATE INDEX idx_assignments_deadline ON assignments(status, due_date);
CREATE INDEX idx_assignments_course ON assignments(course_id, status);
-- Existing grading_rubric values are preserved. Convert legacy plain text to
-- JSON [{"criteria":"...","description":"...","weight":100}] before using it.
