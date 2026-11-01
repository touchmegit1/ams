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

Profile `prod` bắt buộc có `JWT_SECRET`: chuỗi Base64 chứa ít nhất 32 byte ngẫu nhiên. Tạo khóa bằng PowerShell, rồi điền kết quả vào `JWT_SECRET=` trong `backend/.env` và giữ bí mật khóa này:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
[Convert]::ToBase64String($bytes)
```

Để có MySQL và dữ liệu test từ đầu, chạy duy nhất `backend/db/ams_demo.sql` bằng MySQL Workbench hoặc `mysql -u root -p < backend/db/ams_demo.sql`. Script **xóa rồi tạo lại toàn bộ `ams_db`**; chỉ dùng trên database local không cần giữ dữ liệu. Spring Boot không tự chạy file này. Đặt `SPRING_PROFILE=prod` và cấu hình `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` trong `backend/.env` để backend dùng MySQL.

Dữ liệu mẫu gồm tài khoản admin, giảng viên, sinh viên; khóa miễn phí `AMS-FREE-101`, khóa trả phí 100.000đ `AMS-PAID-201`, một khóa nháp, học phần, bài học và bài tập mẫu. Sinh viên chưa đăng ký khóa nào để có thể thử cả hai luồng. Cả ba tài khoản mẫu dùng mật khẩu `Admin@123`.

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

### Tạo dữ liệu mẫu trên MySQL

Chạy `backend/db/ams_demo.sql` trên MySQL local mới. File tạo sẵn `admin@gmail.com`, `teacher@gmail.com` và `student@gmail.com`, cùng các khóa học và nội dung mẫu. Không chạy file này trên database đang có dữ liệu cần giữ.
