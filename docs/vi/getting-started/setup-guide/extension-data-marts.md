---
title: Data Mart từ extension
description: Di chuyển hoặc kiểm tra Data Mart được tạo từ extension cũ.
---

Data Mart từ extension có thể cần kiểm tra lại Storage, schema và quyền trước khi chạy trên webapp hiện tại.

## Điều kiện

- Bạn là member của project đích.
- Storage nguồn vẫn truy cập được.
- Connector hoặc credential cũ đã được reconnect nếu provider yêu cầu OAuth.

## Các bước

1. Vào **Data Marts** và chọn Data Mart được migrate.
2. Mở **Settings** để xác nhận project, Storage và schema.
3. Chạy **Test connection** hoặc manual run.
4. Kiểm tra output schema và Data quality checks.
5. Publish lại nếu schema đã thay đổi, sau đó kiểm tra Run History.

Nếu Storage cũ không còn khả dụng, tạo Storage mới theo [hướng dẫn Storage](storage.md), cập nhật cấu hình rồi chạy thử trước khi bật lịch.

Xem thêm [Tạo Data Mart](data-mart.md) và [Xử lý sự cố](../../troubleshooting.md).
