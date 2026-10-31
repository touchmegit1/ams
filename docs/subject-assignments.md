# Giảng viên giao bài — Module 3

Đăng nhập bằng tài khoản TEACHER hoặc ADMIN, chọn **Bài tập** trên dashboard.
Đường dẫn chính: `/teacher/assignments`; thư viện mẫu: `/teacher/assignment-templates`.
Giao diện dùng API thật và JWT của module đăng nhập hiện có.

## Dữ liệu và cấu hình

- Subject chính là Course. Dropdown chỉ liệt kê khóa học có `courses.teacher_id`
  trùng tài khoản giảng viên; ADMIN thấy tất cả. Module này không tạo khóa học
  hoặc tự cấp quyền TEACHER/ADMIN. Nếu dropdown trống, cần dữ liệu từ module Course.
- Giữ thông tin MySQL thực tế trong `backend/.env`. Dùng `SPRING_PROFILE=dev`
  khi frontend chạy ở HTTP localhost. Dev vẫn dùng DB_URL trong `.env`.
- Khi nâng cấp database theo schema cũ, chạy thủ công
  `backend/db/migrations/V20261031_01__subject_assignments.sql` **một lần trước
  khi khởi động backend mới**. Không chạy lại nếu Hibernate đã thêm các cột.
  Dự án hiện dùng `ddl-auto=update`; script không tự chạy và không dùng Flyway.
  Database mới có thể được Hibernate tạo các bảng cần cho module này; bảng của
  Enrollment và Submission do các module tương ứng cung cấp.
- `backend/db/seed_assignment_template.sql` cung cấp một mẫu dùng chung khi đã
  có tài khoản ADMIN. Chạy thủ công nếu cần mẫu ban đầu.
- Rubric lưu JSON trong `assignments.grading_rubric`, gồm criteria, description,
  weight. Dữ liệu rubric dạng text cũ cần chuyển đổi thủ công; không tự ghi đè.
- Để dùng AI, thêm `GEMINI_API_KEY=...` vào backend/.env. Có thể chọn model bằng
  `GEMINI_MODEL=gemini-flash-latest`. Key chỉ dùng ở backend, không đưa vào frontend.
  API sử dụng [Gemini generateContent](https://ai.google.dev/api/generate-content).
  Chưa có key thì thao tác tạo AI báo lỗi rõ ràng; tạo thủ công vẫn hoạt động.

## Quy tắc và tích hợp

- Tạo mới luôn DRAFT. Lưu và xuất bản yêu cầu rubric đủ 100%, hạn tương lai,
  tiêu đề/nội dung/môn học hợp lệ và điểm > 0 (tối đa 999.99 theo DECIMAL(5,2)).
- Chỉ DRAFT/PUBLISHED được sửa; chỉ DRAFT được xóa. Luồng:
  DRAFT → PUBLISHED → CLOSED → ARCHIVED. Sai trạng thái trả HTTP 409.
- Job mỗi 60 giây đóng bài PUBLISHED đã đến hạn; optimistic locking ngăn việc
  chỉnh sửa đồng thời ghi đè trạng thái của job.
- Generate/Regenerate chỉ trả đề, không ghi DB. Người dùng xem lại, chỉnh sửa
  rồi lưu. Timeout upstream 30 giây trả 504, phản hồi lỗi hoặc đề không hợp lệ
  trả 502; thiếu key trả 503.
  Tạo đề AI từ màn chỉnh sửa sẽ tạo một bản nháp AI mới, giữ nguyên bài gốc.
- Template dùng chung có course_id NULL; template gắn course chỉ được xem bởi
  giảng viên phụ trách hoặc ADMIN. usage_count tăng khi tạo bài có templateId,
  không tăng khi sửa bài.
- Mốc dueDate dùng local datetime nhất quán với các bảng hiện có. Frontend và
  backend triển khai cần dùng cùng múi giờ (hiện tại Asia/Saigon).
- Đếm ghi danh từ enrollments (payment_status=PAID), đếm sinh viên đã nộp từ
  submissions. Nếu chưa có bảng, API trả null và UI ghi “Chưa kết nối”.
- Bàn giao Huy: bảng assignments với status=PUBLISHED, course_id, grading_rubric
  (JSON), due_date, max_score và allowed_file_types. Module nộp bài cần kiểm tra
  đã thanh toán/ghi danh, status và deadline trước khi cho sinh viên xem/nộp.
  Các endpoint quản lý hiện chỉ mở cho TEACHER/ADMIN; không mở API này cho STUDENT.

## Chạy và kiểm thử

```powershell
cd backend
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
# Terminal khác:
cd frontend
npm.cmd run dev
```

Integration test bao phủ vòng đời, ẩn lưu trữ, rubric/hạn nộp, phân quyền và
quyền sở hữu, template usage, AI chưa có key không ghi dữ liệu, job quá hạn.
Kiểm tra giao diện: danh sách → tạo nháp → chi tiết → xuất bản → đóng → lưu trữ;
thử tổng rubric khác 100%; chọn mẫu; AI Review → tạo lại/bỏ/lưu; tài khoản
STUDENT không truy cập được routes dành cho giảng viên.


## Loại bài tập và câu hỏi trắc nghiệm

- Chọn **Bài tự luận / tài liệu** để cấu hình định dạng tệp sinh viên được nộp
  (DOC, DOCX, PDF, ZIP…). Đây là cấu hình hình thức nộp, chưa phải chức năng
  đính kèm đề từ tệp Word hoặc xuất đề thành tệp Word.
- Chọn **Bài trắc nghiệm** để thêm tối đa 100 câu. Mỗi câu có 2–10 lựa chọn,
  chọn **một đáp án** hoặc **nhiều đáp án**, rồi đánh dấu đáp án đúng.
  Chuyển về một đáp án giữ đáp án đầu tiên đã đánh dấu; xóa lựa chọn tự cập nhật
  chỉ số đáp án đúng. Câu hỏi và lựa chọn được giữ khi đổi loại bài trong form;
  khi lưu bài tài liệu, backend xóa dữ liệu trắc nghiệm của bài đó.
- API tạo/sửa nhận thêm `assignmentType` (`DOCUMENT` hoặc `QUIZ`) và `questions`:
  `{text, type: "SINGLE" | "MULTIPLE", options: string[], correctAnswers: number[]}`.
  `correctAnswers` dùng chỉ số bắt đầu từ 0. Backend kiểm tra đáp án trong phạm vi,
  không trùng, và đúng số lượng cho câu chọn một đáp án. Request cũ không có
  `assignmentType` được hiểu là `DOCUMENT`.
- Câu hỏi lưu JSON trong `assignments.questions_json`; loại bài lưu ở
  `assignments.assignment_type`. Với database quản lý schema thủ công, dùng
  `backend/db/migrations/V20261031_02__assignment_questions.sql` trước khi chạy
  phiên bản mới. Không chạy script nếu `ddl-auto=update` đã thêm các cột.
- Trang chi tiết giảng viên hiển thị lựa chọn cùng đáp án đúng. API này vẫn chỉ
  dành cho TEACHER/ADMIN. Module làm bài sinh viên cần DTO riêng không trả đáp án
  đúng; phần nộp bài/chấm trắc nghiệm thuộc module sinh viên.
- Trợ lý AI hiện tạo đề tự luận; câu trắc nghiệm được soạn thủ công.
- Dashboard và trang bài tập dùng chung `WorkspaceHeader`. Điều hướng dùng View
  Transitions khi trình duyệt hỗ trợ, có hiệu ứng CSS dự phòng và tôn trọng
  `prefers-reduced-motion`.
