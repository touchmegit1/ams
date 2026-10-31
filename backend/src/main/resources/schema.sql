DROP DATABASE IF EXISTS ams_db;
CREATE DATABASE ams_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ams_db;

-- =========================================================================
-- 1. BẢNG USERS 
-- Chức năng 1: Login System | External: Student, Teacher, Google Service (Mail, Login)
-- =========================================================================
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,           -- NULL nếu login qua Google
    role ENUM('STUDENT', 'TEACHER', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    
    -- Tích hợp Google Service (Login & Mail)
    google_id VARCHAR(100) NULL UNIQUE,        -- ID tài khoản trả về từ Google OAuth2
    avatar_url VARCHAR(500) NULL,              -- Ảnh đại diện lấy từ Google Profile
    otp_code VARCHAR(10) NULL,                 -- Mã OTP gửi qua Google Mail (Gmail SMTP)
    otp_expiry DATETIME NULL,                  -- Thời gian hết hạn mã OTP
    otp_hash VARCHAR(255) NULL,
    otp_requested_at DATETIME NULL,
    otp_attempts INT NOT NULL DEFAULT 0,
    auth_version INT NOT NULL DEFAULT 0,
    password_reset_token_hash VARCHAR(64) NULL UNIQUE,
    password_reset_expiry DATETIME NULL,
    password_reset_requested_at DATETIME NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,         -- Trạng thái đã xác thực Gmail
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 2. BẢNG COURSES, MODULES, LESSONS 
-- Chức năng 2: Manage Courses | External: Teacher, Gemini API
-- =========================================================================
CREATE TABLE courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    
    -- Tích hợp Gemini API (Hỗ trợ Teacher tạo dàn ý/mô tả khóa học)
    ai_prompt TEXT NULL,                       -- Prompt giáo viên gửi cho Gemini API
    is_ai_generated BOOLEAN DEFAULT FALSE,     -- Đánh dấu khóa học có dùng Gemini gợi ý
    
    status ENUM('DRAFT', 'PUBLISHED') DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE modules (
    module_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    order_index INT NOT NULL DEFAULT 1,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

CREATE TABLE lessons (
    lesson_id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content LONGTEXT,                          -- Nội dung bài giảng (có thể sinh từ Gemini API)
    video_url VARCHAR(500) NULL,
    
    -- Tích hợp Gemini API (Sinh nội dung bài học tự động cho Teacher)
    ai_prompt TEXT NULL,                       -- Prompt yêu cầu Gemini viết bài giảng
    is_ai_generated BOOLEAN DEFAULT FALSE,
    
    order_index INT NOT NULL DEFAULT 1,
    FOREIGN KEY (module_id) REFERENCES modules(module_id) ON DELETE CASCADE
);

-- =========================================================================
-- 3. BẢNG ASSIGNMENTS 
-- Chức năng 3: Manage Subject Assignments | External: Teacher, Gemini API
-- =========================================================================
CREATE TABLE assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,                 -- Đề bài (Teacher tự soạn hoặc Gemini API sinh)
    
    -- Tích hợp Gemini API (Tạo đề & Tiêu chí chấm chuẩn cho AI)
    ai_prompt TEXT NULL,                       -- Prompt Teacher dùng để bảo Gemini tạo đề bài
    grading_rubric TEXT NOT NULL,              -- Đáp án mẫu / Barem điểm để Gemini dựa vào chấm ở mục 5
    
    max_score DECIMAL(5, 2) DEFAULT 10.00,
    due_date DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

-- =========================================================================
-- 4. BẢNG ENROLLMENTS 
-- Chức năng 4: Enroll Course with Payment | External: Student, PayOS/SEPay
-- =========================================================================
CREATE TABLE enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    
    -- Tích hợp cổng thanh toán PayOS / SEPay
    payment_gateway ENUM('PAYOS', 'SEPAY') NOT NULL DEFAULT 'SEPAY',
    order_code VARCHAR(100) NOT NULL UNIQUE,   -- Mã đơn hàng nội bộ gửi sang PayOS/SEPay (VD: AMS10293)
    gateway_transaction_id VARCHAR(150) NULL,  -- Mã giao dịch thực tế trả về từ Webhook PayOS/SEPay
    qr_code_url VARCHAR(500) NULL,             -- Link VietQR / Checkout URL từ PayOS/SEPay
    payment_status ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED') DEFAULT 'PENDING',
    
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME NULL,                     -- Thời điểm nhận Webhook báo tiền về thành công
    FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

-- =========================================================================
-- 5. BẢNG SUBMISSIONS 
-- Chức năng 5: Submit & Evaluate Assignment with AI | External: Student, Gemini API
-- =========================================================================
CREATE TABLE submissions (
    submission_id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    student_id INT NOT NULL,
    submission_text LONGTEXT NOT NULL,         -- Bài làm của Student gửi lên
    file_url VARCHAR(500) NULL,                -- File đính kèm (nếu có)
    
    -- Tích hợp Gemini API (Chấm điểm và nhận xét bài làm tự động)
    ai_score DECIMAL(5, 2) NULL,               -- Điểm số do Gemini API chấm dựa trên grading_rubric
    ai_feedback TEXT NULL,                     -- Lời phê chi tiết của Gemini API trả về
    ai_evaluated_at DATETIME NULL,             -- Thời gian Gemini API phản hồi kết quả
    
    teacher_score DECIMAL(5, 2) NULL,          -- Điểm do giáo viên phúc khảo/chốt (nếu có)
    status ENUM('SUBMITTED', 'AI_EVALUATED', 'TEACHER_REVIEWED') DEFAULT 'SUBMITTED',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE
);
