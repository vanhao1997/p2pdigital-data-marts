---
title: Webhook
description: Gửi sự kiện project tới endpoint HTTPS.
---

Chỉ dùng endpoint HTTPS có xác thực và timeout phù hợp. Kiểm tra chữ ký nếu provider hỗ trợ, gửi thử event, rồi theo dõi response code và retry. Không đưa secret vào URL hoặc body tùy ý.
