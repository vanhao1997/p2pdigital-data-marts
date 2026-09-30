---
title: Tạo Báo cáo và lịch chạy
description: Kết nối Data Mart đã xuất bản với Điểm đến và tự động cập nhật dữ liệu.
---

Báo cáo xác định cách dữ liệu từ một Data Mart được gửi tới Điểm đến. Trước khi tạo Báo cáo, hãy chuẩn bị Data Mart đã xuất bản, dữ liệu nguồn có thể truy cập và Điểm đến đã được xác thực.

## Tạo Báo cáo

1. Mở Data Mart đã xuất bản.
2. Trong phần **Điểm đến**, chọn **Thêm Báo cáo**.
3. Đặt tên để người dùng nhận biết mục đích của Báo cáo.
4. Chọn Điểm đến và nhập thông tin đích theo hướng dẫn trên màn hình. Ví dụ, với Google Sheets, chọn bảng tính và trang tính nhận dữ liệu.
5. Chọn trường hoặc cấu hình lọc nếu giao diện có cung cấp.
6. Lưu Báo cáo, sau đó chạy thử và kiểm tra dữ liệu tại Điểm đến.

Tên nút và các trường cấu hình có thể khác nhau tùy loại Điểm đến. Chỉ cấp quyền cần thiết cho tài khoản hoặc người dùng kết nối.

## Lên lịch cập nhật

Nếu Data Mart hỗ trợ trigger, mở tab **Triggers** và thêm trigger phù hợp. Trigger **Report Run** có thể dùng lịch ngày, tuần, tháng hoặc khoảng thời gian; chọn múi giờ và thời điểm phù hợp với quy trình nghiệp vụ.

Connector có thể có trigger riêng để lấy dữ liệu từ nguồn. Hãy kiểm tra thứ tự đồng bộ: dữ liệu nguồn cần được cập nhật trước khi Báo cáo chạy. Nếu hệ thống nguồn hoặc Điểm đến có lịch riêng, tránh cấu hình lịch trùng lặp không cần thiết.

## Kiểm tra và xử lý lỗi

- Mở **Run History** để xem thời điểm chạy, trạng thái và thông báo lỗi.
- Xác nhận Data Mart đã xuất bản, Storage và nguồn còn truy cập được.
- Kiểm tra quyền của Điểm đến và giới hạn API của nền tảng.
- So sánh số liệu sau khi chạy với nguồn và bộ lọc đã chọn.
- Sau khi thay đổi schema hoặc cấu hình, chạy thử lại trước khi phụ thuộc vào lịch tự động.

Xem thêm [Hướng dẫn Điểm đến](destination.md), [Hướng dẫn Data Mart](data-mart.md) và [trigger cho Data Mart dựa trên SQL](https://docs.p2pdigital.io.vn/docs/getting-started/setup-guide/report-triggers/).
