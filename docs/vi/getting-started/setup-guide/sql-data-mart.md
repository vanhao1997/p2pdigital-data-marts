---
title: Data Mart từ SQL
description: Tạo Data Mart bằng câu lệnh SQL có kiểm soát.
---

Chọn SQL Data Mart khi logic biến đổi cần viết bằng SQL và chạy trên Storage đã kết nối.

1. Chọn **Tạo Data Mart → SQL**.
2. Chọn Storage và viết query có giới hạn hợp lý.
3. Dùng preview để kiểm tra cột, kiểu dữ liệu và thời gian chạy.
4. Lưu, chạy thử, xử lý lỗi quyền hoặc timeout.
5. Publish sau khi output schema ổn định.

Không chèn secret trực tiếp vào SQL. Dùng configuration variable hoặc credential reference theo chính sách project.

Xem thêm [Calculated fields](calculated-fields.md), [Data quality checks](data-quality-checks.md) và [Data Mart](data-mart.md).
