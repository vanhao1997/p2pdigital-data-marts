---
title: Từ điển chỉ số Data Mart
description: Nguồn, công thức, độ hạt, múi giờ và chu kỳ cập nhật cho các chỉ số Data Mart.
---

Các định nghĩa dưới đây là hợp đồng dữ liệu cho dashboard project. Chỉ hiển thị chỉ số
khi nguồn tương ứng khả dụng; trạng thái `Unavailable` không được diễn giải thành `0`.

| Chỉ số          | Nguồn và công thức                                                                                                                                                                                                                                 | Độ hạt                                      | Múi giờ                                                         | Cập nhật                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Data Mart count | `COUNT(data_mart.id)` với `data_mart.projectId = projectId` và `deletedAt IS NULL`; gồm cả `DRAFT` và `PUBLISHED`.                                                                                                                                 | Một project tại thời điểm truy vấn.         | Không áp dụng cho số đếm; thời điểm snapshot là UTC.            | Mỗi lần tải hoặc làm mới danh sách.                                                |
| Published count | Cùng tập Data Mart trên, thêm `status = 'PUBLISHED'`. Không dùng `modifiedAt` để suy ra thời điểm publish.                                                                                                                                         | Một project tại thời điểm truy vấn.         | Không áp dụng cho số đếm; thời điểm snapshot là UTC.            | Mỗi lần tải hoặc làm mới danh sách.                                                |
| Run errors      | `COUNT(data_mart_run.id)` với `status IN ('FAILED', 'INTERRUPTED', 'RESTRICTED')`, lọc qua Data Mart thuộc project và `createdAt` trong khoảng chọn. Hiển thị từng trạng thái riêng khi cần phân tích nguyên nhân.                                 | Một run, một project, một khoảng thời gian. | Lưu/lọc theo UTC; hiển thị theo timezone người dùng.            | Sau khi run hoàn tất và danh sách được làm mới.                                    |
| Run warnings    | Chưa có trường trạng thái `WARNING` trong `DataMartRunStatus`; không tính bằng cách tìm chuỗi trong `logs`/`errors`. Chỉ triển khai sau khi có taxonomy warning được lưu có cấu trúc.                                                              | Chưa khả dụng.                              | Chưa áp dụng.                                                   | Chưa khả dụng.                                                                     |
| Last updated    | `data_mart.dataLastUpdated.dataLastUpdatedAt`: thời điểm mới nhất **bất kỳ** bảng nguồn nào thay đổi theo metadata warehouse. `computedAt` là thời điểm đo, không phải thời điểm dữ liệu thay đổi. Chỉ tin cậy đầy đủ khi `coverage = 'complete'`. | Một Data Mart và tập nguồn của nó.          | Timestamp ISO UTC; hiển thị theo timezone người dùng.           | Snapshot được làm mới khi người dùng yêu cầu tính lại; không có lịch sync cố định. |
| Data freshness  | `now - dataLastUpdatedAt`, so với ngưỡng giờ cấu hình cho scope nếu `coverage = 'complete'` và timestamp hợp lệ. `partial`/`unavailable` phải hiển thị riêng, không gán nhãn fresh.                                                                | Một Data Mart tại thời điểm đánh giá.       | Tính bằng UTC; chỉ định dạng hiển thị theo timezone người dùng. | Tính lại khi snapshot hoặc ngưỡng thay đổi.                                        |
| API freshness   | Chưa có nguồn timestamp sync thống nhất cho mọi connector. Không suy ra từ HTTP response, `modifiedAt` hoặc lần mở trang. Chỉ triển khai sau khi connector cung cấp `lastSuccessfulSyncAt`, cadence và retry state có cấu trúc.                    | Một connector trong một project.            | UTC; hiển thị theo timezone người dùng.                         | Theo lần sync thành công của từng connector.                                       |

Dashboard cần phân biệt rõ `loading`, `no data`, `not configured`, `stale data`,
`connector error`, `permission denied` và `unavailable`. `No data` nghĩa là truy vấn
thành công nhưng tập kết quả rỗng; `unavailable` nghĩa là chưa thể xác định số liệu.

Operational metrics trong log không phải số liệu billing. Xem
[hợp đồng observability](../../getting-started/deployment-guide/observability.md)
để biết nguồn và giới hạn của từng counter.
