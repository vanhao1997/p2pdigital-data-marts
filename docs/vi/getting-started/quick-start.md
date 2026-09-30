---
title: Bắt đầu nhanh
description: Các bước đầu tiên để sử dụng P2PDigital Data Marts trên cloud hoặc môi trường tự quản lý.
---

## Sử dụng bản cloud

1. Mở [P2PDigital Data Marts](https://digitalreport.p2pdigital.io.vn).
2. Đăng nhập và chọn dự án.
3. Tạo **Kho lưu trữ** để kết nối BigQuery, Snowflake, Databricks hoặc nền tảng được hỗ trợ. Kiểm tra kết nối trước khi lưu.
4. Tạo Data Mart từ connector, SQL, bảng, khung nhìn hoặc mẫu bảng; kiểm tra schema và mô tả trước khi xuất bản.
5. Tạo hoặc xác thực **Điểm đến**, sau đó thêm Báo cáo cho Data Mart đã xuất bản.
6. Chạy thử Báo cáo và kiểm tra dữ liệu tại Điểm đến. Nếu cần, cấu hình trigger và múi giờ trong [Tạo Báo cáo và lịch chạy](setup-guide/report-and-schedule.md).

## Tự triển khai

Giữ nguyên các lệnh CLI và biến môi trường trong [Quick Start tiếng Anh](https://docs.p2pdigital.io.vn/docs/getting-started/quick-start/). Khi thay đổi public origin, cần cập nhật đồng bộ OAuth redirect URI, CSP và cấu hình proxy.

## Kiểm tra hoàn tất

- Data Mart hiển thị trạng thái đã xuất bản.
- Lịch sử chạy có kết quả thành công hoặc thông báo lỗi rõ ràng.
- Báo cáo nhận đúng dữ liệu tại Điểm đến đã chọn.
