# @owox/web

## 0.33.0

### Minor Changes 0.33.0

- f13fc57: Update runtime dependencies to address known security advisories in HTTP requests, gRPC certificate authorization, TOML parsing, and URI/query parsing. The HTTP and gRPC updates stay within the existing major versions, preserving integration compatibility.

  Pin the FTP dependency used by `get-uri` to `basic-ftp` 6.2.1 to address directory-listing denial of service, preserving the Databricks SQL client and proxy stack versions.

  FTP data connections now use the control host by default (`allowSeparateTransferHost: false`). The supported same-host FTP/PAC path is covered by runtime compatibility fixtures; deployments using a separate FTP transfer host require compatibility review before rollout.

  Deployment images use the verified dependency versions from the release lockfile, avoiding vulnerable packages inherited from an older runtime image. Image checks verify the installed dependency inventory and application readiness before publication.

- d706ab3: Sau khi lưu báo cáo Email thành công, cửa sổ chỉnh sửa đóng đúng và giữ người dùng ở danh sách báo cáo. Luồng lưu vẫn cho phép chỉnh sửa lại báo cáo khi cần.

  Nếu máy chủ từ chối tạo hoặc cập nhật báo cáo, biểu mẫu hiển thị lỗi của lần lưu hiện tại và cho phép thử lại.

  Refs #13.

- d706ab3: FormulaEditor giữ đầy đủ nội dung khi gõ nhanh và chèn gợi ý cột. Danh sách gợi ý hiển thị đúng khi thay đổi kích thước cửa sổ chỉnh sửa.

  Refs #14.

- d706ab3: Khi không thể xóa insight template đang được báo cáo sử dụng, giao diện hiển thị lý do từ máy chủ. Insight và báo cáo liên quan được giữ nguyên để người dùng xử lý liên kết trước khi xóa.

  Sau khi xóa thành công từ trang chi tiết, danh sách cập nhật ngay khi quay lại và không hiển thị insight đã xóa từ cache.

  Refs #15.

- d706ab3: Luồng chỉnh sửa destination giữ đúng destination đã mở qua liên kết. Thao tác lưu cập nhật destination hiện có và giữ các thay đổi sau khi tải lại trang.

  Thay đổi liên kết destination trên cùng trang, quay lại liên kết trước hoặc mở lại sau khi đóng đều tải đúng destination.

  Refs #16.

- d706ab3: Người dùng tài khoản native có thể mở trang dự án và tạo dự án đầu tiên sau khi đăng nhập. Dự án đã chọn nhưng chưa có quyền truy cập vẫn hiển thị luồng yêu cầu cấp quyền.

  Refs #17.

- 9998511: # Project Overview

  Projects now show visible Data Marts, configured connector providers, and currently running connector syncs with quick links into project data.

- 9998511: # Mobile Navigation

  The mobile sidebar now closes after navigation, including when selecting the current route.

- ed79dd5: Add an in-app MCP and ChatGPT setup guide with project-scoped draft Data Mart
  prompts, endpoint copying, OAuth troubleshooting, and credential and sync-cost
  warnings. Open the guide from Projects or Project Settings. The guide supports
  Vietnamese and English and keeps publishing separate from draft creation.
- 264cdcf: Rebrand to P2PDigital, add Vietnamese (VI) language support, increase project limit to 50
  - Replaced OWOX branding with P2PDigital across all user-facing text, logo, and URLs
  - Added react-i18next with English and Vietnamese locale files
  - Added language switcher (EN/VI) in the user menu with localStorage persistence
  - Localized Data Marts overview hints and actions to match the selected language
  - Increased organization/project creation limit from 20 to 50

## 0.32.0

## 0.31.0

## 0.30.1

## 0.30.0

## 0.29.0

## 0.28.0

## 0.27.1

## 0.27.0

## 0.26.0

## 0.25.0

## 0.24.0

## 0.23.0

## 0.22.0

## 0.21.1

## 0.21.0

## 0.20.0

## 0.19.0

## 0.18.0

## 0.17.0

## 0.16.0

## 0.15.0

## 0.14.0

## 0.13.0

## 0.12.0

## 0.11.0

## 0.10.0

## 0.9.0

## 0.8.0

## 0.7.0

## 0.6.0
