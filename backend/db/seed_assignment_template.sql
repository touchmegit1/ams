-- Optional: install one shared template after an ADMIN account exists.
-- No account is created and no existing role is elevated by this script.
INSERT INTO assignment_templates
  (name, course_id, description, default_max_score, default_rubric, created_by, usage_count, created_at, updated_at)
SELECT 'Bài thực hành REST API', NULL,
  'Thiết kế và xây dựng một REST API. Nộp mã nguồn, hướng dẫn chạy và tài liệu endpoint. Cần xử lý validation, phân quyền và kiểm thử các luồng chính.',
  10.00,
  '[{"criteria":"Chức năng","description":"Các API đáp ứng đúng yêu cầu nghiệp vụ","weight":40},{"criteria":"Chất lượng mã","description":"Cấu trúc rõ ràng, xử lý lỗi và phân quyền phù hợp","weight":30},{"criteria":"Kiểm thử và tài liệu","description":"Có kiểm thử và hướng dẫn chạy đầy đủ","weight":30}]',
  u.user_id, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users u
WHERE u.role = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM assignment_templates WHERE name = 'Bài thực hành REST API' AND course_id IS NULL)
ORDER BY u.user_id LIMIT 1;
