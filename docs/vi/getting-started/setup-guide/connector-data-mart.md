---
title: Data Mart từ connector
description: Lấy dữ liệu từ connector đã cấu hình và đưa vào Data Mart.
---

## Khi nào dùng

Dùng loại này khi nguồn dữ liệu có connector được P2PDigital hỗ trợ và cần đồng bộ theo lịch.

## Điều kiện

Storage đích đã tồn tại, credential có quyền đọc nguồn và connector không bị giới hạn quota.

## Các bước

1. Chọn **Data Marts → Tạo Data Mart → Connector**.
2. Chọn connector, cấu hình field và phạm vi dữ liệu.
3. Chọn Storage, kiểm tra output schema rồi lưu.
4. Chạy thử, xử lý warning/error và publish khi schema đúng.
5. Thêm connector trigger nếu cần đồng bộ tự động.

Xem thêm [Storage](storage.md), [Output controls](output-controls.md) và [Connector triggers](connector-triggers.md).
