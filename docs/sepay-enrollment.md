# Đăng ký khóa học qua SEPay

## Cấu hình

1. Với MySQL dùng để test, chạy `backend/db/ams_demo.sql` để tạo lại toàn bộ `ams_db` và dữ liệu mẫu. **Script xóa database cũ**; không dùng để nâng cấp database production. Môi trường dev H2 dùng Hibernate `ddl-auto=update`.
2. Khai báo `SEPAY_BANK` (mã ngân hàng VietQR, ví dụ `VCB`), `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ORDER_PREFIX` (2–5 chữ cái, mặc định `AMS`) và `SEPAY_WEBHOOK_SECRET` trong môi trường backend. Không ghi secret vào Git.
3. Liên kết tài khoản ngân hàng trên SePay. Cấu hình mã thanh toán với đúng tiền tố và hậu tố 10 ký tự chữ/số. Tạo webhook cho sự kiện **Có tiền vào**, tới `https://<backend-host>/api/webhooks/sepay`, xác thực **HMAC-SHA256**, dùng cùng secret với backend. Chỉ chọn tài khoản ngân hàng đã khai báo.
4. Webhook cần HTTPS công khai. Dùng tính năng gửi thử trên SePay trước, sau đó thử một khoản chuyển nhỏ và kiểm tra trang **Đối soát thanh toán** của admin.

## Quy tắc xử lý

- Khóa miễn phí kích hoạt ngay. Khóa trả phí tạo mã chuyển khoản mới với hạn 5 giờ. Một sinh viên có một đăng ký trên mỗi khóa học; lần thử thanh toán cũ được giữ để đối soát.
- Backend xác minh chữ ký trên raw body, timestamp trong 5 phút, mã giao dịch duy nhất, tài khoản nhận, số tiền, mã thanh toán và thời điểm giao dịch. Chỉ giao dịch hợp lệ mới cấp quyền học.
- Giao dịch sai hoặc đến muộn được lưu ở trang đối soát. Admin có thể ghi chú và đóng hồ sơ; thao tác này không cấp quyền học hoặc hoàn tiền.
- Sinh viên đã đăng ký vẫn xem nội dung khi khóa học được lưu trữ. Khóa đã có lịch sử đăng ký không được xóa vĩnh viễn.

Tài liệu tham khảo: [VietQR](https://docs.sepay.vn/tao-qr-code-vietqr-dong.html), [webhook](https://docs.sepay.vn/tich-hop-webhooks.html), [HMAC](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc).
