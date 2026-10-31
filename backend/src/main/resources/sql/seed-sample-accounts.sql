-- Sample accounts for local development. Run after schema.sql and
-- admin-migration.sql have been applied to the ams_db database.
-- All three use the sample password: Admin@123
-- Re-running this script resets only these sample accounts to that password.

INSERT INTO users (full_name, email, password_hash, role, is_verified, is_enabled)
SELECT 'Sample Teacher', 'teacher@gmail.com',
       '$2a$12$RA6RVxEog.vcRPW2ya2XKu5L5bTmTcREpFcqzrUBVF65TOaOcsjhi',
       'TEACHER', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'teacher@gmail.com');

INSERT INTO users (full_name, email, password_hash, role, is_verified, is_enabled)
SELECT 'Sample Student', 'student@gmail.com',
       '$2a$12$xMUqrmn4jBv99RdIv04HAOhk1VverCUWna/zo8PQKQb8.huI1Woru',
       'STUDENT', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'student@gmail.com');

UPDATE users
SET password_hash = '$2a$12$RA6RVxEog.vcRPW2ya2XKu5L5bTmTcREpFcqzrUBVF65TOaOcsjhi',
    auth_version = auth_version + 1
WHERE email = 'teacher@gmail.com'
  AND (password_hash IS NULL OR password_hash <> '$2a$12$RA6RVxEog.vcRPW2ya2XKu5L5bTmTcREpFcqzrUBVF65TOaOcsjhi');

UPDATE users
SET password_hash = '$2a$12$xMUqrmn4jBv99RdIv04HAOhk1VverCUWna/zo8PQKQb8.huI1Woru',
    auth_version = auth_version + 1
WHERE email = 'student@gmail.com'
  AND (password_hash IS NULL OR password_hash <> '$2a$12$xMUqrmn4jBv99RdIv04HAOhk1VverCUWna/zo8PQKQb8.huI1Woru');
