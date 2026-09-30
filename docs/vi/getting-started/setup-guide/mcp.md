---
title: Kết nối MCP
description: Kết nối trợ lý AI với Data Marts qua MCP và OAuth.
---

MCP cho phép client tương thích như Claude hoặc ChatGPT khám phá Data Mart và chạy các thao tác được cấp quyền qua OAuth. Bạn cần một project đang hoạt động và ít nhất một Data Mart.

## Kết nối

1. Mở phần Connectors hoặc MCP của client AI.
2. Thêm endpoint `https://mcp.owox.com/mcp` (hoặc URL project cụ thể do webapp cung cấp).
3. Hoàn tất đăng nhập trong cửa sổ trình duyệt.
4. Chọn project cần cấp quyền và xác nhận scope được yêu cầu.
5. Quay lại client, kiểm tra connector đã ở trạng thái Connected.

Token OAuth có thời hạn ngắn và client sẽ tự refresh. Nếu session bị revoke hoặc refresh thất bại, hãy ngắt kết nối rồi thực hiện lại flow.

## Kiểm tra và bảo mật

- Gọi tool `get_project_context` trước thao tác đầu tiên để client hiểu phạm vi project.
- Không đưa password, API key, PII không cần thiết vào Project context.
- Kiểm tra project đang chọn trước khi chạy query hoặc tạo report.
- Nếu nhận `401`, đăng nhập lại; nếu nhận `403`, kiểm tra member role và project context.

Xem thêm [Khái niệm cốt lõi](../core-concepts.md) và [Xử lý sự cố](../../troubleshooting.md).
