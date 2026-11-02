-- AMS local MySQL demo setup. DESTRUCTIVE: deletes the entire ams_db database.
-- Run only against a disposable local database, never against production data.
-- MySQL 8: mysql -u root -p < backend/db/ams_demo.sql
-- Spring Boot does not execute this file automatically (spring.sql.init.mode=never).

DROP DATABASE IF EXISTS ams_db;
CREATE DATABASE ams_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ams_db;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    role ENUM('STUDENT','TEACHER','ADMIN') NOT NULL DEFAULT 'STUDENT',
    google_id VARCHAR(100) UNIQUE,
    avatar_url VARCHAR(500),
    otp_code VARCHAR(10),
    otp_expiry DATETIME,
    otp_hash VARCHAR(255),
    otp_requested_at DATETIME,
    otp_attempts INT NOT NULL DEFAULT 0,
    auth_version INT NOT NULL DEFAULT 0,
    password_reset_token_hash VARCHAR(64) UNIQUE,
    password_reset_expiry DATETIME,
    password_reset_requested_at DATETIME,
    is_verified BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    course_code VARCHAR(32) UNIQUE,
    title VARCHAR(200) NOT NULL,
    subject VARCHAR(120),
    target_audience VARCHAR(200),
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_courses_teacher FOREIGN KEY (teacher_id) REFERENCES users(user_id)
);

CREATE TABLE modules (
    module_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    order_index INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_modules_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

CREATE TABLE lessons (
    lesson_id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content LONGTEXT,
    video_url VARCHAR(500),
    order_index INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_lessons_module FOREIGN KEY (module_id) REFERENCES modules(module_id) ON DELETE CASCADE
);

CREATE TABLE assignment_templates (
    template_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    course_id INT,
    description TEXT NOT NULL,
    default_max_score DECIMAL(5,2) DEFAULT 10.00,
    default_rubric TEXT NOT NULL,
    created_by INT NOT NULL,
    usage_count INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_template_course FOREIGN KEY (course_id) REFERENCES courses(course_id),
    CONSTRAINT fk_template_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    lesson_id INT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    grading_rubric TEXT NOT NULL,
    allowed_file_types VARCHAR(100),
    max_score DECIMAL(5,2) DEFAULT 10.00,
    due_date DATETIME,
    status ENUM('DRAFT','PUBLISHED','CLOSED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    source ENUM('MANUAL','AI','TEMPLATE') NOT NULL DEFAULT 'MANUAL',
    template_id INT,
    created_by INT,
    ai_prompt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assignment_type VARCHAR(20) NOT NULL DEFAULT 'DOCUMENT',
    questions_json LONGTEXT,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_assignments_course FOREIGN KEY (course_id) REFERENCES courses(course_id),
    CONSTRAINT fk_assignments_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE SET NULL,
    CONSTRAINT fk_assignments_template FOREIGN KEY (template_id) REFERENCES assignment_templates(template_id),
    CONSTRAINT fk_assignments_creator FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_assignments_deadline (status, due_date),
    INDEX idx_assignments_course (course_id, status),
    INDEX idx_assignments_lesson (lesson_id, status)
);

CREATE TABLE quiz_attempts (
    attempt_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    student_id INT NOT NULL,
    answers_json LONGTEXT NOT NULL,
    score DECIMAL(7,2) NOT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quiz_attempt_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    CONSTRAINT fk_quiz_attempt_student FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_quiz_attempt_student_assignment (student_id, assignment_id)
);

-- Legacy submissions table remains for assignment statistics.
CREATE TABLE submissions (
    submission_id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    student_id INT NOT NULL,
    submission_text LONGTEXT NOT NULL,
    file_url VARCHAR(500),
    ai_score DECIMAL(5,2),
    ai_feedback TEXT,
    ai_evaluated_at DATETIME,
    teacher_score DECIMAL(5,2),
    status ENUM('SUBMITTED','AI_EVALUATED','TEACHER_REVIEWED') DEFAULT 'SUBMITTED',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_submissions_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    CONSTRAINT fk_submissions_student FOREIGN KEY (student_id) REFERENCES users(user_id)
);

CREATE TABLE course_enrollments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    activated_at DATETIME(6),
    CONSTRAINT uq_enrollment_student_course UNIQUE (student_id, course_id),
    CONSTRAINT fk_enrollment_student FOREIGN KEY (student_id) REFERENCES users(user_id),
    CONSTRAINT fk_enrollment_course FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

CREATE TABLE enrollment_payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id BIGINT NOT NULL,
    order_code VARCHAR(20) NOT NULL UNIQUE,
    amount DECIMAL(12,2) NOT NULL,
    account_number VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    paid_at DATETIME(6),
    sepay_transaction_id BIGINT UNIQUE,
    CONSTRAINT fk_payment_enrollment FOREIGN KEY (enrollment_id) REFERENCES course_enrollments(id),
    INDEX idx_payment_enrollment (enrollment_id)
);

CREATE TABLE sepay_transactions (
    id BIGINT PRIMARY KEY,
    received_at DATETIME(6) NOT NULL
);

CREATE TABLE payment_reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sepay_transaction_id BIGINT NOT NULL UNIQUE,
    order_code VARCHAR(20),
    account_number VARCHAR(30),
    amount DECIMAL(12,2),
    reason VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL,
    note VARCHAR(1000),
    created_at DATETIME(6) NOT NULL,
    closed_at DATETIME(6)
);

-- Demo accounts: all passwords are Admin@123. Use only in local testing.
INSERT INTO users (user_id, full_name, email, password_hash, role, is_verified, is_enabled) VALUES
(1, 'Quản trị viên mẫu', 'admin@gmail.com', '$2a$12$a.iq5K5kzfTM9Ls.zksSC.wlNuyUkM5xXmGpnu8Eg/GPvKOzAfJhG', 'ADMIN', TRUE, TRUE),
(2, 'Giảng viên mẫu', 'teacher@gmail.com', '$2a$12$RA6RVxEog.vcRPW2ya2XKu5L5bTmTcREpFcqzrUBVF65TOaOcsjhi', 'TEACHER', TRUE, TRUE),
(3, 'Sinh viên mẫu', 'student@gmail.com', '$2a$12$xMUqrmn4jBv99RdIv04HAOhk1VverCUWna/zo8PQKQb8.huI1Woru', 'STUDENT', TRUE, TRUE);

-- The student is intentionally not enrolled yet: test both free and paid registration from the UI.
INSERT INTO courses (course_id, teacher_id, course_code, title, subject, target_audience, description, price, status) VALUES
(1, 2, 'AMS-FREE-101', 'Nhập môn REST API', 'Lập trình Web', 'Sinh viên mới bắt đầu', 'Khóa miễn phí để thử đăng ký và truy cập bài học ngay.', 0, 'PUBLISHED'),
(2, 2, 'AMS-PAID-201', 'Xây dựng Spring Boot API', 'Lập trình Web', 'Sinh viên đã biết Java', 'Khóa có phí để thử QR VietQR, webhook và hạn thanh toán 5 giờ.', 100000, 'PUBLISHED'),
(3, 2, 'AMS-DRAFT-301', 'Khóa học chưa xuất bản', 'Lập trình Web', 'Giảng viên', 'Dùng để kiểm tra khóa nháp không nhận đăng ký.', 50000, 'DRAFT');

INSERT INTO modules (module_id, course_id, title, order_index) VALUES
(1, 1, 'Tổng quan REST', 1),
(2, 2, 'Nền tảng Spring Boot', 1),
(3, 2, 'Bảo mật API', 2),
(4, 3, 'Nội dung nháp', 1);

INSERT INTO lessons (module_id, title, content, order_index) VALUES
(1, 'REST là gì?', 'Nội dung mẫu: giới thiệu tài nguyên, HTTP method và status code.', 1),
(2, 'Tạo REST Controller', 'Nội dung trả phí mẫu: tạo endpoint GET/POST trong Spring Boot.', 1),
(3, 'JWT và phân quyền', 'Nội dung trả phí mẫu: bảo vệ endpoint bằng JWT.', 1),
(4, 'Bài học nháp', 'Chỉ giảng viên quản lý khóa nháp được xem nội dung này.', 1);

INSERT INTO assignment_templates (name, course_id, description, default_max_score, default_rubric, created_by) VALUES
('Bài thực hành REST API', NULL, 'Thiết kế REST API và viết tài liệu endpoint.', 10.00,
 '[{"criteria":"Chức năng","description":"API đáp ứng yêu cầu","weight":70},{"criteria":"Kiểm thử","description":"Có kiểm thử các luồng chính","weight":30}]', 1);

INSERT INTO assignments (course_id, title, description, grading_rubric, max_score, due_date, status, source, created_by, assignment_type) VALUES
(1, 'Thiết kế API đầu tiên', 'Tạo các endpoint GET và POST cho một tài nguyên.',
 '[{"criteria":"Chức năng","description":"Endpoint hoạt động","weight":100}]', 10.00,
 TIMESTAMPADD(DAY, 14, CURRENT_TIMESTAMP), 'PUBLISHED', 'MANUAL', 2, 'DOCUMENT');
