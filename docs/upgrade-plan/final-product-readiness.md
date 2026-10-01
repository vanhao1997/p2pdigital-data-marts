# Trạng thái hoàn thiện sản phẩm — 2026-10-01

## MVP đã thực hiện

- Sửa contract Coolify `v4.0.0-beta.473`: kiểm tra cả hai Docker Image resource trước khi PATCH, dùng port healthcheck dạng string và đọc lại cấu hình trước deploy.
- Chặn UUID trùng và resource còn dùng source build trước mọi thay đổi deployment.
- Nâng Axios lên `1.20.0` và gRPC lên `1.14.5` trong các dependency liên quan, giữ nguyên major version.
- Runtime dùng base Node `22.22.3` được pin bằng digest và cài mới production dependencies từ npm lockfile trên Linux; không kế thừa dependency tree từ image OWOX cũ.
- Thêm gate audit package thực tế trong cả hai candidate image, trước smoke và push. Lỗi inventory hoặc dịch vụ advisory làm gate thất bại.
- Cập nhật changeset bảo mật của Issue `#10`; bỏ mô tả TOML chưa được vá đã lỗi thời.
- Chuẩn bị hai Docker Image resource thay thế trong project/environment hiện tại, chưa khởi động hoặc chuyển traffic.
- Sao chép runtime environment, private network, healthcheck và directory mount của database. Không lưu giá trị secret trong báo cáo.

## Bằng chứng xác thực

| Kiểm tra                                              | Kết quả quan sát                                                                                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI của SHA `4e0512dc7e851c6b7299ab0bfb73155133e5e17e` | Lint, test, build, bundle budget, hai image smoke và push đạt; deploy thất bại ở Coolify HTTP 422. Đây là bằng chứng cho SHA cũ, không chứng nhận bản vá mới.                      |
| Contract workflow                                     | YAML, Bash và 14 kịch bản API giả lập đạt.                                                                                                                                         |
| Helper audit image                                    | 20 checks đạt; ESLint và Prettier đạt. Hai working-tree candidate Linux đã audit 0 advisory; CI/GHCR của SHA mới còn cần xác nhận.                                                 |
| Runtime audit source sau bản vá                       | `npm audit --omit=dev`: 0 advisory.                                                                                                                                                |
| IDP client                                            | 5 suites, 23 tests đạt; typecheck đạt.                                                                                                                                             |
| Web HTTP/error tests                                  | 2 files, 18 tests đạt.                                                                                                                                                             |
| Dockerfile dependency fixtures                        | Copy root/nested, HTTP request, redirect guard, gRPC roundtrip và guard major version đạt.                                                                                         |
| Backup auth DB và app DB                              | SQLite backup API; restore auth 7 bảng, app 84 bảng có integrity `ok`. Candidate và image hiện tại boot từ hai bản sao app riêng, readiness `200`, integrity `ok`; network `none`. |
| Tài khoản được yêu cầu                                | Chrome đã mở được danh sách Data Mart bằng tài khoản được yêu cầu. Đây là phiên hiện có; fresh login/refresh/restart chưa kiểm tra. Email được giữ ngoài tài liệu repo.            |
| Token Coolify                                         | Người dùng xác nhận đã xoay và cập nhật secret store; API đọc được bằng credential lấy từ Windows user environment.                                                                |

Gate web đầy đủ của bản vá đã đạt:

- `npm test -w @owox/web`: 266 files, 2.369 tests đạt.
- `npm run lint -w @owox/web`: exit code 0.
- `npm run type-check -w @owox/web`: exit code 0.

## Tiếp tục ngày 2026-10-01

- Script staging có 18 guard checks đạt; context thực tế gồm 8 workspace artifacts và 18 manifests. `package.json` và lockfile trong context giữ nguyên bytes từ checkout.
- Sửa dependency `@owox/ui` của web thành workspace `*`, bỏ hai lock records trỏ sai `apps/packages/ui`. Không nâng version hoặc đổi resolved/integrity của package ngoài phạm vi.
- Giữ CLI `serve` và migration commands, CommonJS/ESM exports, root user, working directory và SQLite data path hiện có.
- Linux `npm ci --omit=dev` đã cài 1.465 packages trong candidate build. Audit image main: 1.465 installed copies, 1.354 unique name/version pairs, 0 advisory. Probe native `better-sqlite3` và CommonJS helpers đạt; `/health/ready` trả `200`, UI trả `200`, container `healthy`. Đây là working-tree candidate local, chưa chứng nhận image GHCR của SHA mới.
- Sidecar candidate Linux: 77 installed copies, 75 unique name/version pairs, 0 advisory. `/healthz` trả `200`, container `healthy`; Chromium launch và page probe đạt. CI smoke kiểm tra native SQLite/CommonJS và Chromium trước push.
- Sửa locator manual run theo nhãn `Manual run...`; `RUN-02` đã đạt với toàn ca 90 giây, giữ assertion run history 15 giây và response `201`.
- Browser CI có budget toàn ca 90 giây, timeout tổng test 45 phút và job 60 phút để upload diagnostics. Lần chạy local với budget cũ 20 phút: 61 pass, 14 fail, 73 chưa chạy. Các lỗi fixture/selector/focus đang được sửa và xác thực lại; chưa đánh dấu suite 148 tests đạt.
- Đã boot candidate và image hiện tại từ hai bản sao app backup riêng trong network `none`, không mount database live: readiness `200`, integrity `ok`; candidate 85 bảng sau migration, image hiện tại 84 bảng. Auth restore giữ 7 bảng và integrity `ok`. Chưa kiểm tra fresh login bằng auth restore hoặc chuyển traffic rollback.

## Cấu hình chuyển image

| Resource | Hiện tại                   | Thay thế đã chuẩn bị       |
| -------- | -------------------------- | -------------------------- |
| Main     | `b28iq4vagsm5pcghhckg1fli` | `w7o3yetefi0h89xa54thd173` |
| Sidecar  | `vmmuqrrbnehbcpielsthjdlc` | `ogjemhzck5epcq7ask3gugmq` |

Main thay thế dùng port `3000`, `/health/ready` và mount `/root/.local/share/owox` từ cùng directory dữ liệu. Main hiện tại dùng port `3008`.

Sidecar thay thế dùng port `8091`, `/healthz`, cùng private network và không có public domain. Main thay thế trỏ extractor URL tới sidecar thay thế.

Hai resource thay thế chưa chạy. Chưa cập nhật GitHub resource UUID hoặc chuyển public domain. Không khởi động hai main instance cùng ghi database SQLite.

Backup nằm trên server tại `/data/owox-backups/2026-10-01-final/`; chỉ ghi đường dẫn và trạng thái kiểm tra, không đưa dữ liệu database vào repo.

## V1: acceptance còn cần hoàn tất

1. Chạy CI đầy đủ trên SHA của bản vá và audit dependencies thực tế trong cả hai candidate image.
2. Xác nhận GHCR pull, staging/canary, readiness và rollback trước chuyển production.
3. Xác nhận tài khoản trong Chrome bằng phiên đăng nhập mới. Người dùng nhập mật khẩu trực tiếp.
4. Chạy acceptance Admicro với credential thật nhập trong UI: preview, extract, reconnect, retry và checkpoint theo ngày.
5. Chạy live MCP với Codex/Claude, refresh/restart và project A/B theo deployment guide. Test SDK không thay thế acceptance này.
6. Ghi nhận billing mode: `LICENSE` không tính phí connector/process run; dùng report hoặc `MCP_QUERY_RUN` để xác nhận một lần charge. `INTERNAL` kiểm tra connector consumption sau thành công. Preview, failed/cancelled run và retry không tạo charge trùng.
7. Xác định Issue sở hữu MCP: `.changeset/10-mcp-2026-protocol.md` đang dùng số của Issue bảo mật; chưa đổi hoặc đoán số mới.

## Data model và rủi ro còn cần xác thực

Không thay schema ứng dụng, metric formula, timezone, sync cadence hoặc billing contract. Data Mart và run vẫn được phân tách bằng project; IDP giữ account, session và membership hiện có.

Helper audit chỉ gửi `{ packageName: [installedVersion] }` tới npm advisory API. Kết quả gồm package name, advisory ID và severity; không gửi source, environment, credential hoặc database.

- **Security:** source audit không chứng minh dependencies của base image; gate candidate image phải đạt. Không đưa credential hoặc magic link vào log.
- **Tenant isolation:** production project A/B acceptance chưa chạy; không suy ra pass từ tài khoản admin hoặc smoke readiness.
- **Data sync:** fixture CI đã có cho SHA cũ; chưa có acceptance provider thật trên candidate mới. Preview thành công không thay thế extract/checkpoint/retry.
- **Billing:** chưa có live evidence về một lần charge, retry và cancellation trên candidate mới.

Metric source, formula, grain, timezone và refresh contract nằm trong `docs/analytics/metric-dictionary.md`. Dữ liệu unavailable không được hiển thị như zero.

## Future

- Avatar object storage, kiểm tra size/type và crop UI.
- Template version, draft/published state, restore, audit log và optimistic locking.
- MCP subscriptions, tasks, elicitation, resumability và shared multi-node sessions sau khi có implementation và acceptance riêng.

Các mục future chưa nằm trong phạm vi bản vá release này.
