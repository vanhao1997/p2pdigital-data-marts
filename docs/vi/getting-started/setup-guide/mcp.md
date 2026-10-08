---
title: Kết nối MCP
description: Kết nối trợ lý AI với Data Marts qua MCP và OAuth.
---

MCP cho phép Codex, Claude hoặc client tương thích khám phá dữ liệu, cấu hình kết nối và tạo Data Mart bằng prompt. Bạn cần một project đang hoạt động và quyền phù hợp; có thể bắt đầu khi project chưa có Data Mart.

## Kết nối

1. Mở phần Connectors hoặc MCP của client AI.
2. Thêm endpoint `https://mcp.owox.com/mcp` (hoặc URL project cụ thể do webapp cung cấp).
3. Hoàn tất đăng nhập trong cửa sổ trình duyệt.
4. Chọn project cần cấp quyền và xác nhận scope được yêu cầu.
5. Quay lại client, kiểm tra connector đã ở trạng thái Connected.

Token OAuth có thời hạn ngắn và client sẽ tự refresh. Nếu session bị revoke hoặc refresh thất bại, hãy ngắt kết nối rồi thực hiện lại flow.

### Codex với DigitalReport

Endpoint của bản triển khai DigitalReport là
`https://digitalreport.p2pdigital.io.vn/mcp`. Thêm vào `~/.codex/config.toml`
nếu server chưa được cấu hình:

```toml
[mcp_servers.digitalreport]
url = "https://digitalreport.p2pdigital.io.vn/mcp"
```

Đăng nhập trên máy chạy Codex:

```bash
codex mcp login digitalreport --scopes mcp:read,mcp:write
```

Giữ lệnh đang chạy, mở URL OAuth mới do lệnh tạo, đăng nhập và chọn project.
Chờ CLI xác nhận thành công rồi mở task Codex mới. Không đổi callback
`127.0.0.1`, không tái sử dụng URL của lần đăng nhập hết hạn và không dán bearer
token vào cấu hình.

Prompt kiểm tra:

> Dùng MCP digitalreport, gọi get_project_context và xác nhận project đang kết nối.

## Kết nối nguồn dữ liệu

Nguồn có hai phần: storage warehouse để lưu/truy vấn dữ liệu và connector để
đọc dữ liệu nhà cung cấp. MCP sử dụng các loại có sẵn trong backend; không tự
tạo thêm tích hợp nhà cung cấp.

| Tool                          | Chức năng                                                                  |
| ----------------------------- | -------------------------------------------------------------------------- |
| `list_data_storages`          | Liệt kê storage được phép xem trong project.                               |
| `list_connectors`             | Khám phá các connector backend đang cung cấp.                              |
| `get_connector_specification` | Xem metadata cấu hình, các trường bắt buộc và lựa chọn xác thực.           |
| `get_connector_fields`        | Xem node và field connector hỗ trợ.                                        |
| `create_data_storage`         | Tạo storage và trả ID cùng URL hoàn tất cấu hình.                          |
| `configure_data_storage`      | Lưu cấu hình không chứa secret và tham chiếu credential đã được cấp quyền. |
| `validate_data_storage`       | Kiểm tra quyền truy cập/kết nối theo luồng validation hiện có.             |

`create_data_storage` nhận `storage_type`, `title`. Các loại hỗ trợ gồm Google
BigQuery, AWS Athena, Snowflake, AWS Redshift và Databricks. Legacy Google
BigQuery vẫn có thể dùng theo quyền hiện có nhưng không tạo mới qua MCP.

`configure_data_storage` nhận `storage_id`, `title`, `config`, cùng đúng một
tham chiếu `credential_id` hoặc `source_storage_id`. Backend kiểm tra
project, loại storage, quyền sửa và quyền copy credential; scope `mcp:write`
không thay thế quyền tài khoản.

Nếu chưa có credential, mở URL setup do tool trả về để hoàn tất OAuth hoặc
nhập credential trong webapp. Connector OAuth và token thủ công cũng thực
hiện trong giao diện cấu hình Data Mart. Có thể tái sử dụng cấu hình/credential
của Data Mart được cấp quyền. Không đưa password, API key, service-account JSON,
webhook secret hoặc refresh token vào prompt. ID tồn tại không chứng minh kết
nối đã hoạt động; phải đọc trạng thái và validate trước khi tiếp tục.

Prompt ví dụ:

> Liệt kê storage và connector của project. Tạo storage BigQuery tên Marketing,
> rồi đưa tôi link để hoàn tất xác thực. Chưa tạo lịch hoặc chạy sync.

## Tạo và sửa Data Mart

| Tool                         | Chức năng                                                  |
| ---------------------------- | ---------------------------------------------------------- |
| `create_data_mart`           | Tạo Data Mart ở trạng thái `DRAFT`.                        |
| `update_data_mart`           | Sửa tên, mô tả và definition theo quyền hiện có.           |
| `validate_data_mart`         | Kiểm tra definition trước khi publish.                     |
| `publish_data_mart`          | Publish Data Mart khi người dùng yêu cầu rõ ràng.          |
| `get_data_mart_setup_status` | Xem trạng thái setup, storage, credential và run gần nhất. |

Tạo mới nhận `title`, `storage_id`, tùy chọn `description` và cặp
`definition_type`/`definition`. Definition dùng schema hiện có: `SQL`, `TABLE`,
`VIEW`, `TABLE_PATTERN` hoặc `CONNECTOR`. Codex phải lấy connector specification
và field metadata trước khi dựng cấu hình, thay vì đoán tên field/node.

Thiếu credential hoặc definition chưa hoàn thiện thì tiếp tục cấu hình draft
trong webapp. Khi lỗi sau một bước đã lưu, dùng ID đã trả về để đọc trạng thái
và sửa tiếp; không tự tạo lại storage hoặc Data Mart vì có thể sinh bản trùng.

Prompt ví dụ:

> Tạo draft Data Mart Admicro Daily trên storage Marketing. Xem specification
> AdmicroAds, chọn node và fields phù hợp, hướng dẫn tôi hoàn tất credentials.
> Chưa publish.
> Đọc trạng thái setup của Data Mart vừa tạo, cập nhật mô tả và validate.
> Publish Data Mart đã validate. Giải thích lần chạy connector phát sinh và
> cho tôi link Run History.

**Publish connector Data Mart có tác dụng phụ:** luồng hiện có có thể khởi động
một incremental run ngay sau publish, ghi dữ liệu vào warehouse và phát sinh
connector consumption theo cấu hình billing. Tool publish phải giải thích hành
vi này; tạo hoặc sửa cấu hình không tự publish hay chạy extraction. Đợt mở rộng
này không thêm tool chạy connector thủ công hoặc lịch sync.

## Quyền, dữ liệu và consumption

- Read tools cần `mcp:read`; tạo/sửa/validate/publish cần `mcp:write`. Token được
  gắn với project chọn lúc OAuth; backend vẫn kiểm tra role và quyền từng tài nguyên.
- MCP không trả credential payload. Metadata cấu hình và kết quả query có thể
  được gửi tới nhà cung cấp AI của client.
- Tạo/sửa cấu hình không tạo consumption extraction/report. Validation có thể
  gọi API warehouse/provider; phí của nhà cung cấp tuân theo hợp đồng của họ.
- `query_data_mart` giữ policy consumption hiện có. Lần chạy connector sau
  publish giữ luồng run identity, checkpoint, retry và billing hiện có.
- SQL definition dùng để cấu hình Data Mart. `query_data_mart` vẫn chỉ nhận
  truy vấn có cấu trúc, không phải công cụ chạy SQL tùy ý.

## Phạm vi nghiệm thu

- MVP: dùng connector/storage hiện có, credential qua web hoặc tham chiếu đã được
  cấp quyền; draft, validate và publish là các bước riêng.
- V1: nghiệm thu Codex OAuth, project A/B, credential thực tế và provider/billing
  thực tế. Test fixture không thay thế các bằng chứng này.
- Future: chạy sync thủ công, lịch sync, nhà cung cấp mới và tự dựng relationship.

## Kiểm tra và bảo mật

- Gọi tool `get_project_context` trước thao tác đầu tiên để client hiểu phạm vi project.
- Không đưa password, API key, PII không cần thiết vào Project context.
- Kiểm tra project đang chọn trước khi tạo kết nối, sửa Data Mart, publish hoặc chạy query/report.
- Nếu nhận `401`, đăng nhập lại; nếu nhận `403`, kiểm tra member role và project context.

Xem thêm [Khái niệm cốt lõi](../core-concepts.md) và [Xử lý sự cố](../../troubleshooting.md).
