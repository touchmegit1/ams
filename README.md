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
