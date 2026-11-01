-- Run once on an existing MySQL database.
ALTER TABLE users MODIFY COLUMN role ENUM('STUDENT', 'TEACHER', 'ADMIN') NOT NULL DEFAULT 'STUDENT';
ALTER TABLE users ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Sample admin: admin@gmail.com / Admin@123
-- The password is stored as a BCrypt hash; the account is inserted only if absent.
INSERT INTO users (full_name, email, password_hash, role, is_verified, is_enabled)
SELECT 'Quản trị viên mẫu', 'admin@gmail.com',
       '$2a$12$EzVREdiM76qaY4HbDn5HueyLCfezl8ujOA0IgS0HyqxhTnv2P2Kr6',
       'ADMIN', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@gmail.com');

-- Keep the sample password in sync if the account was created by an earlier script.
UPDATE users SET password_hash = '$2a$12$EzVREdiM76qaY4HbDn5HueyLCfezl8ujOA0IgS0HyqxhTnv2P2Kr6', auth_version = auth_version + 1
WHERE email = 'admin@gmail.com';
