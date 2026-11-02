# AMS – Course Management

Hệ thống quản lý khóa học gồm frontend React/Vite và backend Spring Boot. Frontend gọi backend qua đường dẫn `/api`; backend mặc định chạy cổng `8080`.

## Công nghệ

- Frontend: React, React Router, Axios, Vite
- Backend: Java 17+, Spring Boot 3.5, Spring Security, Spring Data JPA
- Cơ sở dữ liệu: H2 cho profile `dev`; MySQL cho profile `prod`

## Cấu trúc dự án

- `frontend/` – ứng dụng React, mã nguồn trong `src/`
- `backend/` – API Spring Boot; mã nguồn trong `src/main/java/`, cấu hình trong `src/main/resources/`, kiểm thử trong `src/test/`
- `docs/ams-project-design.md` – các luồng AMS và bộ sơ đồ thiết kế theo đầu ra đồ án

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

### Tạo MySQL và dữ liệu mẫu để test

1. Mở `backend/db/ams_demo.sql` bằng MySQL Workbench và chạy toàn bộ file trên MySQL local. File này **xóa rồi tạo lại toàn bộ `ams_db`**. Chỉ dùng trên database thử nghiệm không cần giữ dữ liệu; Spring Boot không tự chạy SQL.
2. Sao chép `backend/.env.example` thành `backend/.env`. Điền `SPRING_PROFILE=prod`, `DB_URL=jdbc:mysql://localhost:3306/ams_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`, `DB_USERNAME`, `DB_PASSWORD` và `JWT_SECRET` như hướng dẫn phía trên.
3. Từ thư mục `backend`, chạy `./mvnw spring-boot:run` (Windows: `.\mvnw.cmd spring-boot:run`), rồi chạy frontend theo mục tiếp theo.

File SQL duy nhất tạo 3 tài khoản, 2 khóa đã xuất bản, 1 khóa nháp, học phần, bài học và bài tập mẫu. Sinh viên chưa đăng ký khóa nào để bạn thử luồng mới.

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Admin | `admin@gmail.com` | `Admin@123` |
| Giảng viên | `teacher@gmail.com` | `Admin@123` |
| Sinh viên | `student@gmail.com` | `Admin@123` |

Đăng nhập bằng sinh viên, vào **Khóa học** hoặc **Đăng ký học** trên dashboard:

- `AMS-FREE-101` (0đ): nhấn **Đăng ký khóa học**; trạng thái chuyển `ACTIVE` và xem được nội dung bài học ngay.
- `AMS-PAID-201` (100.000đ): nhấn **Đăng ký khóa học**; hệ thống tạo mã chuyển khoản và QR có hạn 5 giờ. Muốn tạo QR, backend cần `SEPAY_BANK` và `SEPAY_ACCOUNT_NUMBER` trong `.env`. Dùng tài khoản ngân hàng của bạn, không dùng thông tin giả để chuyển tiền.
- `AMS-DRAFT-301`: chỉ giảng viên nhìn thấy; sinh viên không thể đăng ký.

Để xác nhận thanh toán tự động, liên kết tài khoản ngân hàng với SePay, khai báo `SEPAY_ORDER_PREFIX=AMS` và `SEPAY_WEBHOOK_SECRET`, rồi cấu hình webhook HMAC-SHA256 đến `https://<backend-host>/api/webhooks/sepay`. Backend cần URL HTTPS công khai; localhost không nhận được webhook thật. Chi tiết ở `docs/sepay-enrollment.md`. Giao dịch sai hoặc đến muộn xuất hiện tại **Đối soát thanh toán** trong trang admin.

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

Tài khoản mẫu chỉ dành cho môi trường local. Đổi mật khẩu trước khi đưa ứng dụng ra môi trường dùng thật.
