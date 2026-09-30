---
title: Kiểm tra thời điểm cập nhật dữ liệu
description: Đọc timestamp nguồn và nhận biết dữ liệu stale.
---

**Last updated** là thời điểm hệ thống xác định dữ liệu nguồn đã thay đổi gần nhất. So sánh timestamp với stale threshold của project và timezone hiển thị. Nếu không xác định được timestamp, UI có thể ghi `Unavailable`; điều này khác với `No data`.

Khi dữ liệu stale, kiểm tra connector run, rate limit, credential và retry history trước khi chạy report.
