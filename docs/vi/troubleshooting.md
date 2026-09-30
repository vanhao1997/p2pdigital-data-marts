---
title: Xử lý sự cố
description: Cách kiểm tra và khắc phục các lỗi thường gặp khi dùng P2PDigital Data Marts.
---

## Quy trình kiểm tra chung

Ghi lại project, thời điểm, thao tác vừa thực hiện và `Run History` entry liên quan. Không gửi
access token, API key secret, OAuth authorization code hoặc giá trị configuration variable khi yêu cầu
hỗ trợ. Có thể gửi `requestId`, status code và thông báo đã được che dữ liệu nhạy cảm.

## Đăng nhập hoặc session hết hạn

**Triệu chứng:** Trang chuyển về màn hình đăng nhập hoặc trả `401`.

**Nguyên nhân thường gặp:** Cookie session hết hạn, trình duyệt chặn cookie, hoặc phiên bị thu hồi.

**Cách kiểm tra:** Đăng nhập lại trong cùng trình duyệt, kiểm tra ngày giờ máy và thử cửa sổ riêng tư.

**Cách khắc phục:** Đăng nhập lại; nếu nhiều người gặp lỗi, liên hệ admin để kiểm tra identity provider.

**Khi nào liên hệ admin:** Lỗi lặp lại ngay sau khi đăng nhập hoặc xảy ra với toàn bộ project.

## Project mismatch hoặc permission denied

**Triệu chứng:** `403`, project không mở được, hoặc dữ liệu của project khác không hiển thị.

**Nguyên nhân thường gặp:** Đang chọn nhầm project, member bị đổi role, hoặc session cũ chưa cập nhật.

**Cách kiểm tra:** Chọn lại project, tải lại trang và kiểm tra role trong **Project settings → Members**.

**Cách khắc phục:** Dùng project đúng; admin cần mời lại member hoặc cấp role phù hợp. Không thử đổi
project id trực tiếp trong URL để vượt quyền.

**Khi nào liên hệ admin:** Role đã đúng nhưng request vẫn trả `403`.

## Storage hoặc connector không kết nối được

**Triệu chứng:** Kiểm tra kết nối thất bại, run trả connector error hoặc OAuth reconnect.

**Nguyên nhân thường gặp:** Credential hết hạn, scope bị thu hồi, endpoint sai hoặc provider đang giới hạn tốc độ.

**Cách kiểm tra:** Mở form Storage/Connector, xác thực lại credential và xem `Run History`.

**Cách khắc phục:** Reconnect OAuth, kiểm tra quyền tối thiểu cần thiết, sửa cấu hình rồi chạy thử lại.

**Khi nào liên hệ admin:** Provider báo thành công nhưng P2PDigital vẫn không đọc được dữ liệu.

## Data Mart publish failed hoặc stale data

**Triệu chứng:** Publish thất bại, dữ liệu không đổi, hoặc hiển thị trạng thái stale.

**Nguyên nhân thường gặp:** Schema nguồn thay đổi, Storage chưa đồng bộ, trigger bị lỗi hoặc run timeout.

**Cách kiểm tra:** Đọc trạng thái và timestamp trong **Run History**, kiểm tra `Last updated`, schema và
connector status.

**Cách khắc phục:** Sửa schema/configuration, chạy thủ công, sau đó publish lại nếu hệ thống yêu cầu.
Không retry liên tục khi provider đang rate limit.

**Khi nào liên hệ admin:** Run thất bại sau khi credential và schema đã được xác nhận.

## Report delivery failed

**Triệu chứng:** Data Mart chạy thành công nhưng Google Sheets, Looker Studio, email hoặc webhook không nhận dữ liệu.

**Nguyên nhân thường gặp:** Destination credential hết hạn, quyền ghi bị thu hồi, filter rỗng hoặc lịch chạy sai múi giờ.

**Cách kiểm tra:** Mở Report, kiểm tra destination, filter, schedule và lỗi delivery gần nhất.

**Cách khắc phục:** Reconnect destination, kiểm tra file/người nhận, chạy thử rồi bật lại lịch.

**Khi nào liên hệ admin:** Destination trả lỗi quyền dù credential đã được cấp lại.

## API key `401` hoặc `429`

**Triệu chứng:** Đổi API key trả `401 Unauthorized` hoặc `429 Too Many Requests`.

**Nguyên nhân thường gặp:** Key sai, hết hạn, bị revoke; hoặc vượt giới hạn 5 lần theo key + IP / 30 lần theo IP trong 5 phút.

**Cách kiểm tra:** Kiểm tra API key id, expiry và trạng thái revoke. Với `429`, đọc header `Retry-After`.

**Cách khắc phục:** Dừng retry khi nhận `429`, chờ đúng số giây rồi thử credential hợp lệ. Tạo key mới nếu key đã bị revoke.

**Khi nào liên hệ admin:** Key hợp lệ vẫn `401` sau khi member còn quyền trong project.

## OAuth registration `400`

**Triệu chứng:** Dynamic client registration trả `400`.

**Nguyên nhân thường gặp:** Tính năng đang tắt, redirect URI không hợp lệ/không allowlist, body có field lạ hoặc quá nhiều URI.

**Cách kiểm tra:** Xác nhận `MCP_DYNAMIC_CLIENT_REGISTRATION_ENABLED=true` chỉ trong môi trường đã được duyệt và kiểm tra redirect origin.

**Cách khắc phục:** Gửi metadata đúng schema, dùng HTTPS hoặc loopback hợp lệ, bỏ field không hỗ trợ.

**Khi nào liên hệ admin:** Production cần bật registration hoặc cần thêm origin mới.

## Billing event bị trễ hoặc usage không khớp

**Triệu chứng:** Usage chưa cập nhật hoặc một operation xuất hiện nhiều lần.

**Nguyên nhân thường gặp:** Pub/Sub retry, delivery delay hoặc client retry cùng `dedupeKey`.

**Cách kiểm tra:** Đối chiếu `runId`, `reportRunId`, thời điểm chạy và plan quota.

**Cách khắc phục:** Chờ retry window; không gửi lại event bằng payload mới nếu cùng operation. Ghi lại `dedupeKey` để admin tra cứu.

**Khi nào liên hệ admin:** Usage vẫn sai sau khi event đã được xác nhận accepted hoặc bị tính phí cho run thất bại.
