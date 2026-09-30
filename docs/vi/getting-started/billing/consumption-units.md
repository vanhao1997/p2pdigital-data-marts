---
title: Consumption units và usage
description: Cách P2PDigital Data Marts tính, hiển thị và đối soát consumption.
---

## Consumption unit là gì?

Consumption unit là đơn vị sử dụng cho các operation cloud có xử lý dữ liệu hoặc tạo output.
Mở **Project settings → Credits consumption** để xem usage theo project, thời gian, operation
và license key.

## Operation nào tạo consumption?

- **Report Run**: chạy report để ghi dữ liệu vào destination.
- **Process Run**: chạy AI hoặc operation xử lý có tính phí theo plan.
- **Data Quality Run**: mỗi run hoàn tất thành công được tính theo contract của plan.
- **MCP query**: `query_data_mart` đọc dữ liệu, ghi vào Run History và có thể tạo charge.

Preview, kiểm tra freshness và thao tác chỉ đọc không tự động tạo consumption. Hãy xem plan
đang dùng để biết quota, bậc giá và giới hạn theo operation.

## Retry, lỗi và deduplication

Một run thất bại hoặc bị huỷ không được tính như một run thành công. Retry tạo một run mới;
hệ thống dùng `dedupeKey` để không publish cùng một consumption event nhiều lần. Nếu UI chưa
cập nhật ngay, chờ event xử lý rồi đối chiếu `runId`, `reportRunId`, thời điểm UTC và trạng thái
run.

## Cách đối soát usage

1. Mở **Credits consumption** và chọn khoảng thời gian có cùng timezone với báo cáo nội bộ.
2. Đối chiếu operation, `projectId`, `dataMartId`, `runId` hoặc `reportRunId` với Run History.
3. Phân biệt `accepted` (Pub/Sub đã nhận event) với `consumed` (billing đã ghi nhận event).
4. Kiểm tra quota và plan limit trước khi retry hàng loạt.

Nếu usage vẫn không khớp sau khi event đã được xác nhận hoặc một run thất bại bị tính phí,
lưu các ID đối soát và liên hệ admin. Không gửi API key, OAuth token hoặc raw credential trong
ticket hỗ trợ.
