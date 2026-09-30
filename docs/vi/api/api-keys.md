---
title: API keys
description: Tạo, dùng, giới hạn và thu hồi API key của project an toàn.
---

## Tạo key

1. Mở **Project settings → My API Keys**.
2. Chọn **Create API key**, đặt tên theo integration và đặt thời hạn.
3. Chọn role không vượt quá role của bạn; bật read-only nếu job chỉ đọc.
4. Sao chép giá trị API key ngay khi tạo và lưu trong secret manager.

Secret không thể xem lại. Nếu mất secret, revoke key cũ và tạo key mới.

## Đổi key lấy access token

Gửi `POST /auth/api-keys/exchange` với header `x-owox-api-key-id` và body JSON chứa `apiKeySecret`.
Response thành công trả access token theo contract của API. Không ghi secret hoặc access token vào log.

Invalid credential trả `401 Unauthorized` mà không phân biệt key id không tồn tại và secret sai. Endpoint
giới hạn 5 lần sai theo key + IP và 30 lần sai theo IP trong 5 phút; khi vượt giới hạn trả `429` cùng
`Retry-After`. Client phải dừng retry cho tới khi hết thời gian này.

Token giữ role/read-only restriction của key và vẫn chịu tenant boundary của project. Key hết hạn hoặc
đã revoke không thể đổi token.

## Thu hồi và xoay vòng

Revoke key trước khi xóa integration, khi member rời project hoặc khi secret có khả năng bị lộ. Tạo key
mới, cập nhật secret manager, kiểm tra một request thành công rồi mới xóa key cũ.
