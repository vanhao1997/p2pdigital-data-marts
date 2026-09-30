---
title: Kiểm tra chất lượng dữ liệu
description: Phát hiện dữ liệu thiếu, sai kiểu hoặc vượt ngưỡng trước khi phân phối.
---

Tạo check trên output schema, chọn rule và ngưỡng, sau đó chạy thử với sample. Trạng thái `success`, `warning` và `error` được lưu trong Run History. Error nên chặn publish hoặc delivery tùy chính sách team; warning cần được xem xét trước khi tiếp tục.

Khi sửa rule, chạy lại manual run để xác nhận kết quả và tránh đánh giá trên dữ liệu stale.
