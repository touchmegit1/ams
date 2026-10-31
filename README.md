# AMS – Course Management

Hệ thống quản lý khóa học gồm frontend React/Vite và backend Spring Boot. Frontend gọi backend qua đường dẫn `/api`; backend mặc định chạy cổng `8080`.

## Công nghệ

- Frontend: React, React Router, Axios, Vite
- Backend: Java 17+, Spring Boot 3.5, Spring Security, Spring Data JPA
- Cơ sở dữ liệu: H2 cho profile `dev`; MySQL cho profile `prod`

## Cấu trúc dự án

- `frontend/` – ứng dụng React, mã nguồn trong `src/`
- `backend/` – API Spring Boot; mã nguồn trong `src/main/java/`, cấu hình trong `src/main/resources/`, kiểm thử trong `src/test/`

## Chạy backend

Mặc định backend dùng profile `dev` với H2 trong bộ nhớ; dữ liệu sẽ mất khi ứng dụng khởi động lại. Cần Java 17 trở lên.

```powershell
cd backend
./mvnw spring-boot:run
```

Trên Windows có thể dùng `mvnw.cmd spring-boot:run`. Có thể chạy kiểm thử bằng `./mvnw test` (Windows: `mvnw.cmd test`).

Để dùng MySQL, sao chép `backend/.env.example` thành `backend/.env`, điền thông tin kết nối và đặt `SPRING_PROFILE=prod`. File `.env` không được đưa lên Git. Backend đọc các biến kết nối `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`; cổng mặc định là `8080` (`SERVER_PORT`). Google OAuth và gửi OTP qua Gmail cần các biến `GOOGLE_CLIENT_ID`, `MAIL_USERNAME`, `MAIL_PASSWORD` tương ứng.

`backend/src/main/resources/schema.sql` không được tự động chạy. Script này có thao tác xóa database `ams_db`; hãy xem kỹ trước khi sử dụng.

## Chạy frontend

Cần Node.js và npm. Trong terminal khác:

```powershell
cd frontend
npm install
npm run dev
```

Vite chạy ứng dụng ở địa chỉ hiển thị trong terminal. Nếu cần đăng nhập Google, tạo `frontend/.env` với `VITE_GOOGLE_CLIENT_ID=...`.

Tạo bản build bằng `npm run build`; xem thử bản build bằng `npm run preview`.

## Tài khoản quản trị viên

Trang quản trị ở `/admin` cho phép tìm kiếm, lọc, đổi vai trò và khóa hoặc mở tài khoản. Chỉ tài khoản có vai trò `ADMIN` mới truy cập được. Khi đổi vai trò hoặc trạng thái, các phiên đăng nhập cũ của tài khoản đó hết hiệu lực. Quản trị viên có thể sửa quyền của quản trị viên khác, nhưng không thể tự đổi quyền hoặc tự khóa tài khoản đang đăng nhập.

### Tài khoản mẫu

| Thông tin | Giá trị |
| --- | --- |
| Email | `admin@gmail.com` |
| Mật khẩu | `Admin@123` |
| Đường dẫn sau khi đăng nhập | `/admin` |

Với H2 trong bộ nhớ và profile `dev`, backend tự tạo tài khoản này khi khởi động. Dữ liệu H2 sẽ mất khi dừng backend và được tạo lại ở lần chạy sau.

### Tạo tài khoản mẫu trên MySQL hiện có

1. Sao lưu database trước khi thay đổi cấu trúc bảng `users`.
2. Mở MySQL Workbench (hoặc công cụ SQL đang dùng), kết nối đến database của ứng dụng và chọn database bằng `USE ams_db;` nếu cần.
3. Mở file `backend/src/main/resources/admin-migration.sql` và chạy toàn bộ file **một lần**. File này thêm vai trò `ADMIN`, cột `is_enabled` và tạo tài khoản mẫu với mật khẩu đã băm BCrypt. Nếu email mẫu đã tồn tại, câu lệnh cuối cập nhật mật khẩu và làm hết hiệu lực các phiên cũ.
4. Khởi động lại backend, đăng nhập bằng thông tin ở bảng trên, rồi mở `/admin`.

Không chạy lại hai câu `ALTER TABLE` nếu đã áp dụng migration vì cột `is_enabled` đã tồn tại. Nếu chỉ cần đặt lại mật khẩu tài khoản mẫu, chạy riêng câu `UPDATE users SET password_hash = ... WHERE email = 'admin@gmail.com'` ở cuối file SQL. Hãy đổi mật khẩu mẫu trước khi dùng ngoài môi trường phát triển.
