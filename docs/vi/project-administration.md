---
title: Quản trị project
description: Quản lý member, role, context, biến cấu hình, API key và thông báo trong project.
---

## Member và role

Admin mời member trong **Project settings → Members** và chọn `viewer`, `editor` hoặc `admin`.
Viewer đọc dữ liệu theo quyền được cấp; editor chỉnh sửa cấu hình được phép; admin quản trị member,
context và thiết lập project. Hãy cấp role thấp nhất đáp ứng công việc.

## Ownership và context

Context gom phạm vi dữ liệu hoặc thành viên theo quy trình của tổ chức. Trước khi chia sẻ Data Mart,
kiểm tra owner, project đang chọn và context được áp dụng. Không dùng context để thay thế kiểm tra role.

## Configuration variables

Tạo biến tại **Project settings → Variables**. Dùng `secret_reference` hoặc `credential_reference`
cho dữ liệu nhạy cảm; không dán token vào mô tả, screenshot hoặc ticket. Biến được tham chiếu trong
Data Mart bằng marker tương ứng và hệ thống chỉ resolve khi run có quyền.

## API keys

API key chỉ hiển thị secret một lần. Chọn role thấp hơn requester nếu integration chỉ cần đọc; bật
read-only cho job không được phép mutation; đặt expiry và revoke ngay khi không còn dùng. Lưu secret
trong secret manager của integration, không commit vào repository. Xem [Hướng dẫn API keys](api/api-keys.md).

## Notifications và webhook

Chọn sự kiện cần nhận trong **Project settings → Notifications**. Dùng endpoint HTTPS, xác thực chữ ký
nếu provider hỗ trợ và thử webhook trước khi bật lịch production. Khi đổi secret, rotate cả phía nhận và
phía P2PDigital trong cùng một cửa sổ bảo trì.
