-- Run once against an existing AMS MySQL database.
ALTER TABLE users
    MODIFY COLUMN role ENUM('STUDENT', 'TEACHER', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN auth_version INT NOT NULL DEFAULT 0;

-- Sample admin account: admin@gmail.com / Admin@123
-- The password is stored as a BCrypt hash.
INSERT INTO users (full_name, email, password_hash, role, is_verified, is_enabled)
SELECT 'Quản trị viên mẫu', 'admin@gmail.com',
       '$2a$12$a.iq5K5kzfTM9Ls.zksSC.wlNuyUkM5xXmGpnu8Eg/GPvKOzAfJhG',
       'ADMIN', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@gmail.com');

-- Keep the sample password in sync if the account already existed.
UPDATE users
SET password_hash = '$2a$12$a.iq5K5kzfTM9Ls.zksSC.wlNuyUkM5xXmGpnu8Eg/GPvKOzAfJhG',
    auth_version = auth_version + 1
WHERE email = 'admin@gmail.com';
