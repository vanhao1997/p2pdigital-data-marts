# Ban Giao Sua Loi Toan Bo Du An Cho AI

> Cap nhat: 2026-09-07  
> Repository: `vanhao1997/p2pdigital-data-marts`  
> Workspace: `C:\Users\PC\.gemini\antigravity\scratch\owox-data-marts`

## 1. Muc tieu

Sua cac loi da xac nhan, dua repository ve trang thai co the release an toan:

- Web lint, type-check, test va build deu xanh.
- Facebook Ads bao dung loi permission/credential va khong lam mat moc dong bo.
- Admicro connector va extractor giu dung contract, bao mat va cursor semantics.
- Giao dien tieng Viet khong bi chen chuoi tieng Anh o toast, tooltip, help va run history.
- Khong lo credential, token, account ID, project ID hoac raw provider payload.
- Khong charge billing cho preview/retry; successful connector run chi charge mot lan.
- Khong pha tenant isolation, Data Mart cu, connector cu hoac destination cu.

## 2. Quy tac bat buoc truoc khi sua

AI thuc thi phai doc day du:

1. `AGENTS.md`.
2. `docs/review-rules.md`.
3. `docs/contributing/testing.md`.
4. `docs/contributing/repository/release-strategy.md`.
5. Neu sua backend: `apps/backend/README.md` va `apps/backend/MODULAR_CONVENTIONS.md`.
6. Neu sua database, event, plugin collection hoac analytics delivery: `docs/data-and-event-boundaries.md`.

Bao ve worktree:

- Worktree hien co khoang `441 modified files`, `8 untracked files`, tong `449` thay doi.
- Nhanh `main` dang ahead `origin/main` 4 commit.
- Khong dung `git reset --hard`, `git checkout --`, xoa hang loat, hoac ghi de thay doi cua nguoi dung.
- Truoc khi sua tung file, doc diff hien tai va giu cac thay doi khong thuoc task.
- Khong chay `git add .` khi chua phan loai diff.
- Khong commit, push hoac deploy neu release gate chua xanh.

Bao mat:

- Facebook Access Token, Facebook App Secret va Coolify token tung xuat hien ngoai secret store. Coi tat ca la da bi lo.
- Khong tai su dung, chep vao test, log, fixture, command, tai lieu hoac commit.
- Viec revoke/rotate phai thuc hien trong Meta/Coolify; code khong the tu thu hoi secret.
- Secret moi chi duoc nhap truc tiep vao Meta, Coolify hoac GitHub Secrets.

## 3. Trang thai validation hien tai

Da pass:

```text
npm run type-check -w @owox/web       PASS
npm run check:i18n -w @owox/web       PASS - 3201 keys dong bo
npm run format:check -w @owox/web     PASS
git diff --check                       PASS
npm run test -w @owox/connectors      PASS - 22 files, 230 tests
npm test --prefix apps/admicro-extractor
                                        PASS - 6 files, 19 tests
Backend targeted config test           PASS - 1 test
Production GET /health/ready           HTTP 200 {"reason":"ok"}
```

Dang fail hoac chua du bang chung:

```text
npm run lint -w @owox/web              FAIL - 8 errors
npm run build -w @owox/web             FAIL - TS2307
usePublishDraftsTrigger.test.ts         FAIL - import khong resolve, 0 test
Full web test                           CHUA XANH
Full backend test                       CHUA CO KET QUA HOAN TAT
Production Admicro E2E                  CHUA XAC NHAN
Production Facebook Ads import          FAIL - Meta error #200
```

Trong full web test da quan sat:

```text
ECONNREFUSED ::1:3000
ECONNREFUSED 127.0.0.1:3000
Failed to load iframe page "about:blank"
```

Can tach loi unit-test setup khoi integration test can backend that.

## 4. P0 - Web khong build, lint va test duoc

### Bang chung

File:

```text
apps/web/src/features/data-storage/shared/hooks/usePublishDraftsTrigger.ts:3
```

Import sai:

```ts
import i18n from '../../../../../i18n';
```

Duong dan nay tro toi `apps/web/i18n`, khong ton tai. Module that nam tai:

```text
apps/web/src/i18n/index.ts
```

### Tac dong cua raw error

- Build fail voi `TS2307`.
- Test suite cua hook fail truoc khi chay.
- ESLint sinh 8 loi `no-unsafe-*` day chuyen do `i18n` co error type.
- Release va deploy phai bi chan.

### Xu ly Google Sheets va Drive

1. Sua import toi dung `apps/web/src/i18n` theo pattern gan nhat trong codebase.
2. Chuyen cac toast hardcode con lai trong hook sang key i18n.
3. Bao toan abort/cancellation behavior.
4. Chay targeted test truoc, sau do full web gates.

### Acceptance

- Module resolve dung.
- Hook test chay va pass, khong con `0 test`.
- Huy run van abort polling va goi server abort khi co trigger.
- Backend terminal error duoc hien thi an toan, khong roi ve Axios message chung chung.

## 5. P0 Security - Secret da bi lo

### Thuc trang

Da co credential that trong lich su trao doi:

- Facebook Access Token.
- Facebook App Secret.
- Coolify deploy token.
- Coolify full token.

Khong ghi lai gia tri trong tai lieu nay.

### Xu ly ngoai code bat buoc

1. Revoke Facebook Access Token cu.
2. Rotate Facebook App Secret neu da dung trong production.
3. Revoke hai Coolify token cu.
4. Tao Coolify token moi voi quyen toi thieu cho dung application.
5. Luu token moi trong Coolify/GitHub Secrets.
6. Kiem tra Meta va Coolify audit logs.

### Xu ly trong code

- Scan git history va current diff cho secret pattern.
- Bao dam error sanitizer che `access_token`, `client_secret`, `password`, `cookie`, `authorization`, token bat dau bang `EA`, `act_<id>` va ID dai.
- Test khong dung secret that; chi dung gia tri synthetic ro rang.
- Khong log Page ID, Ad Account ID, project ID, credential ID hoac raw provider response.

## 6. P1 - Facebook Ads bi tu choi permission

### Loi production

```text
(#200) Ad account owner has NOT grant ads_management or ads_read permission
```

### Nguyen nhan co the

- Facebook user khong co role tren Ad Account.
- Token khong co `ads_read`.
- Token khong co `ads_management`.
- App o Development Mode va user khong thuoc App Roles.
- Ad Account thuoc Business khac, user/app/system user chua duoc assign.
- Token het han hoac permission da bi thu hoi.
- Account ID sai hoac nhap kem tien to `act_`.
- Credential moi khong duoc luu vao dung connector/Data Mart dang chay.

### Contract hien tai

- O nhap Account ID chi nhan ID so, khong co `act_`.
- Connector tu tao URL `act_<AccountID>`.
- OAuth scope mac dinh: `ads_read,ads_management`.
- Credential phai project-scoped va connector-scoped.
- Neu moi account deu bi tu choi, khong duoc advance cursor.
- Neu chi mot account bi tu choi, account con lai co the tiep tuc; run phai co warning ro rang.

### Code lien quan

```text
packages/connectors/src/Sources/FacebookMarketing/Source.js
packages/connectors/src/Sources/FacebookMarketing/Connector.js
packages/connectors/test/Sources/FacebookMarketing/Source.test.js
packages/connectors/test/Sources/FacebookMarketing/skipInaccessibleAccounts.test.js
packages/connectors/src/Sources/FacebookMarketing/CREDENTIALS.md
packages/connectors/src/Sources/FacebookMarketing/TROUBLESHOOTING.md
```

### Viec AI can lam

1. Giu `FacebookAuthorizationError` cho global auth failure.
2. Xac minh permission error classifier khong nuot storage/network/429/5xx errors.
3. Khong advance `LastRequestedDate` neu tat ca account fail trong ngay.
4. Khong hien account ID hoac provider secret trong warning/error.
5. Map loi sang trang thai authentication/reconnect thay vi generic HTTP 500.
6. Them/giu test cho partial account failure, all-account failure, token expiry giua run va storage write failure.

### Viec con nguoi phai lam trong Meta

1. Assign Facebook user/app/system user vao Ad Account voi role hop le.
2. Re-authorize voi `ads_read` va `ads_management`.
3. Neu App o Development Mode, them user vao App Roles hoac dua App sang Live sau review can thiet.
4. Kiem tra token bang Meta Access Token Debugger va `/me/adaccounts`.
5. Khong gui token cho AI qua chat.

## 7. P1 - Backend luu va hien thi raw error string

### Diem hien tai

```text
apps/backend/src/data-marts/services/base-run-trigger-handler.service.ts:71
apps/backend/src/data-marts/services/base-run-trigger-handler.service.ts:80
apps/backend/src/data-marts/services/base-run-trigger-handler.service.ts:135
apps/backend/src/data-marts/models/base-report-run.model.ts:111
apps/backend/src/data-marts/models/base-report-run.model.ts:118
```

Backend dang luu `error.message` hoac chuoi tieng Anh truc tiep vao `run.errors` va `lastRunError`.

### Tac dong

- UI tieng Viet van hien loi tieng Anh.
- Frontend khong phan loai duoc auth, permission, quota, validation, retryable hay internal error.
- Provider detail co the lo ID/URL/secret neu sanitizer thieu.
- Stored text kho thay doi hoac dich sau nay.

### MVP xu ly

Khong migration DB neu chua can. Mo rong envelope JSON hien tai theo huong backward-compatible:

```ts
interface OperationalErrorPayload {
  type: 'error' | 'warning';
  at: string;
  code: string;
  params?: Record<string, string | number | boolean>;
  message?: string;
}
```

- `code` va `params` dung de render cho user.
- `message` chi la fallback da sanitize.
- Frontend van doc duoc record cu chi co `{type, at, error}`.
- Khong thay doi outward DTO bang cach derive truc tiep tu entity.

### V1

- Tao central error localizer tai frontend.
- Map cac nhom Facebook, Google OAuth, connector run, report run, billing va validation.
- Raw technical detail chi hien trong khu vuc diagnostic co quyen phu hop.

### Future

- Chuyen sang cot/DTO error co schema version neu can query/analytics tren error code.
- Neu them migration, phai doc `docs/data-and-event-boundaries.md` va test mixed-version rollout.

## 8. P1 - Run lifecycle va data sync

### Failure paths da xac nhan

- Vuot gioi han concurrent run.
- Project archived/read-only.
- Report da `PENDING` hoac `RUNNING`.
- Graceful shutdown.
- Orphaned pending run bi cleanup.
- Connector child process ket thuc khong co terminal success.
- Cancellation den trong luc polling/extract/write.

### Quy tac phai giu

- Khong advance cursor khi mot node, account, campaign scope hoac storage write bi loi.
- Cursor chi advance sau khi toan bo cong viec cua ngay thanh cong.
- Empty result la successful empty table khi provider that su tra empty.
- Empty do auth/permission/global failure khong duoc danh dau thanh cong.
- Retry chi danh cho network, timeout, `429`, `5xx`; auth `400/401/403` khong retry vo han.
- Cancellation phai dung HTTP request, worker va Playwright context/browser.

### Billing

- Preview khong charge.
- Retry noi bo va sidecar retry khong tao charge moi.
- Cancellation va failed run khong duoc charge nhu successful run.
- Mot successful `RunKind.CONNECTOR_RUN` chi charge mot lan.

## 9. P1 - Google Sheets va Google Drive

### Loi/validation hien co

```text
apps/backend/src/data-marts/data-destination-types/google-sheets/services/google-sheets-report-writer.ts:155
apps/backend/src/data-marts/data-destination-types/google-sheets/services/google-sheets-report-writer.ts:166
apps/backend/src/data-marts/data-destination-types/google-sheets/services/google-sheets-report-writer.ts:182
apps/backend/src/data-marts/data-destination-types/google-sheets/services/google-sheets-report-writer.ts:659
```

Failure paths:

- Data Mart khong co connected field.
- Trung ten cot SQL.
- Trung rendered header/display label.
- Khong co OAuth hoac Service Account.
- Spreadsheet khong truy cap duoc.
- Sheet/tab da bi xoa.
- Folder ID khong phai folder.
- Service Account dung My Drive thay vi Shared Drive.
- Service Account thieu role Content Manager.
- Google Drive API chua bat.
- OAuth state het han.
- Token exchange/refresh fail.
- Credential khong ton tai hoac khong thuoc project.

### Xu ly web test setup

- Validate connected fields va duplicate label ngay tren UI truoc run.
- Khong tu dong rename schema neu user chua xac nhan.
- Hien nut reconnect cho credential expired.
- Huong dan Shared Drive va Content Manager ngay tai form.
- Map 12 Google OAuth error codes sang i18n.
- Giu backend authorization/tenant check; frontend khong duoc tu suy doan ownership.

### Brand bug

File sau van co chu `OWOX` trong user-facing error:

```text
apps/backend/src/data-marts/data-destination-types/google-sheets/services/google-sheets-folder-validator.service.ts:95
```

Chuyen thanh `P2PDigital` neu day la text user-facing. Khong thay ky thuat identifier hoac historical metadata neu co compatibility contract.

## 10. P1 - I18n va hardcoded UI

### Trang thai

- `en.json` va `vi.json` dong bo `3201` key.
- Khong co key VI bi thieu trong danh sach `fallback-calls.json`.
- Co `1272` fallback records; `1247` fallback con chua tieng Anh.
- Co `231` literal candidates va `429` VI-English candidates can review thu cong.
- Khong dich ten ky thuat/brand nhu `SQL`, `JSON`, `Markdown`, `Webhook`, `Serverless`, `Provisioned`, `Data Mart`, `Facebook Ads`.

### File uu tien

```text
apps/web/src/shared/utils/showApiErrorToast.ts
packages/ui/src/components/file-drop-textarea.tsx
apps/web/src/features/data-storage/shared/services/data-storage-health-status.service.ts
apps/web/src/features/data-storage/shared/components/DataStorageHealthIndicator/DataStorageHealthStatusView.tsx
apps/web/src/features/data-marts/edit/components/DataMartRunHistoryView/utils.ts
apps/web/src/features/connectors/shared/utils/connector-metadata.ts
apps/web/src/features/connectors/shared/utils/connector-metadata-vi.ts
apps/web/src/i18n/locales/en.json
apps/web/src/i18n/locales/vi.json
```

Known literals:

- `showApiErrorToast.ts`: `(+N more)` va `Something went wrong`.
- `file-drop-textarea.tsx`: file count, max size, invalid Service Account JSON, invalid JSON, read failure.
- `data-storage-health-status.service.ts`: static English health labels.
- `DataStorageHealthStatusView.tsx`: raw `errorMessage` dang uu tien hon ban dich.
- `DataMartRunHistoryView/utils.ts`: `Data Studio data fetching`.
- Connector metadata moi roi ve English neu chua co mapping VI.

### Nguyen tac sua

1. Moi user-facing string vao `t(...)` hoac prop translation boundary phu hop.
2. Them key vao ca EN va VI trong cung patch.
3. Khong dung backend raw error lam primary UI label.
4. Primary label duoc dich; diagnostic detail duoc sanitize va hien phu.
5. Them test cho toast, tooltip, aria-label va accordion/help content quan trong.
6. Khong sua generated docs nhu source of truth.

## 11. P1 - Web test setup

### Van de da quan sat

- Unit test co request toi `localhost:3000`, backend khong chay.
- `happy-dom` bao `Failed to load iframe page "about:blank"`.
- Full test suite chua co mot run xanh sau cac thay doi lon.

### Xu ly

- Dam bao `apps/web/src/test/setup.ts` duoc khai bao trong `setupFiles`.
- Reset MSW handlers sau moi test.
- Unit test phai mock HTTP; integration test moi can backend service.
- Mock iframe hoac tach component iframe khoi logic test.
- Khong che loi bang cach ignore console toan cuc neu no co the la regression that.
- Chay targeted test theo feature truoc khi chay full web test.

## 12. P1 - Changeset va release

GitHub Issues la source of truth; Fibery khong con bat buoc.

Changeset hien tai co Issue number hop le cho cac Issue `#1`, `#2`, `#3`, `#4`, `#5`, `#6`, `#8`, `#10`.

Can review:

```text
.changeset/8-facebook-auth-reconnect.md
```

File nay dang dung `patch`, trong khi release strategy quy dinh normal release dung `minor` va patch digit luon `0`.

AI phai:

- Xac nhan observable release outcome co can changeset.
- Dung GitHub Issue number that, khong doan.
- Khong dung PR number thay Issue number.
- Khong tao changeset cho test/format/refactor noi bo khong doi behavior.
- Khong release neu changeset bat buoc con sai hoac mo ho.

## 13. P1 - Admicro production readiness

### Da co

```text
apps/admicro-extractor
packages/connectors/src/Sources/AdmicroAds
```

Contract:

```text
GET  /healthz
POST /v1/preview
POST /v1/extract
```

Runtime env:

```text
ADMICRO_EXTRACTOR_ENABLED
ADMICRO_EXTRACTOR_URL
ADMICRO_EXTRACTOR_SHARED_SECRET
ADMICRO_EXTRACTOR_MAX_CONCURRENCY
```

Data model:

- `campaign`: `day + platform + campaign_id + campaign_scope`.
- `date`: `day + platform + campaign_scope`.
- Timezone: `Asia/Ho_Chi_Minh`.
- Sync: daily.
- Lookback: 7 days.
- Raw metric: `admicro_column_<id>`.

### Chua xac nhan production

- Credential that.
- Login selector hien tai cua Admicro.
- Desktop va mobile reports.
- `DATAVIEW` that da sanitize.
- HMAC secret giong nhau giua main app va sidecar.
- Sidecar private network health.
- Cancellation khong de lai Chromium process.
- Cursor/deduplicate voi run lai cung ngay.

Public `https://digitalreport.p2pdigital.io.vn/healthz` dang tra SPA HTML, khong phai sidecar health. Day co the la dung vi sidecar phai private. Kiem tra `/healthz` tu Coolify private network, khong expose public chi de smoke test.

### Security va tenant isolation

- Sidecar mot replica trong MVP vi nonce store in-memory.
- HMAC gom timestamp, nonce va body hash.
- Browser context tao theo job va huy sau job.
- Khong luu raw `DATAVIEW`, password hoac cookie lau dai.
- Credential project-scoped, connector-scoped; khong dung chung session giua tenant.

## 14. P2 - Operational error catalog can map i18n

### Billing/project

```text
BI_PROJECT_NOT_ACTIVE
OVERDRAFT_LIMIT_EXCEEDED
LICENSE_REQUIRED
```

Day la restricted state, khong phai connector provider failure.

### Data Mart/output controls

```text
FILTER_COLUMN_UNKNOWN
PRE_JOIN_FILTERS_REQUIRE_JOINED_DATA_MART
AGGREGATION_ON_CALCULATED_FIELD
CALCULATED_FIELD_AS_DIMENSION
CALCULATED_FIELD_BROKEN_REFERENCES
JOINED_CALCULATED_FIELD_UNSUPPORTED
AGGREGATION_REQUIRES_COLUMN_CONFIG
CALCULATED_FIELD_FILTER_REQUIRES_COLUMN_CONFIG
JOINED_UNIQUE_COUNT_REQUIRES_COLUMN_CONFIG
JOINED_UNIQUE_COUNT_SOURCE_UNAVAILABLE
UNIQUE_COUNT_FILTER_UNSUPPORTED
UNIQUE_COUNT_AGGREGATION_UNSUPPORTED
UNIQUE_COUNT_DATE_TRUNC_UNSUPPORTED
UNIQUE_COUNT_COLUMN_NOT_PROJECTABLE
HAVING_FILTER_NOT_AGGREGATED
HAVING_FILTER_INVALID_PLACEMENT
HAVING_ON_BLENDED_SLEEVE_METRIC_NOT_SUPPORTED
HAVING_ON_BLENDED_SLEEVE_CALCULATED_FIELD_NOT_SUPPORTED
INVALID_OPERATOR_FOR_TYPE
DATE_TRUNC_REQUIRES_DATE_COLUMN
DATE_TRUNC_TIMEZONE_REQUIRES_TIMESTAMP
DATE_TRUNC_INVALID_TIMEZONE
DATE_TRUNC_COLUMN_IS_AGGREGATED
DATE_TRUNC_TIMEZONE_ON_CALCULATED_FIELD
AGGREGATION_COLUMN_NOT_SELECTED
DATE_TRUNC_COLUMN_NOT_SELECTED
SORT_COLUMN_NOT_SELECTED
AGGREGATION_FUNCTION_NOT_ALLOWED_FOR_FIELD
AGGREGATION_FUNCTION_NOT_ALLOWED_FOR_TYPE
DUPLICATE_AGGREGATION
```

Giu error code on dinh. Dich message tai client; khong viet logic phan loai bang substring neu code da co.

### Plugin

- Invalid repo locator.
- GitHub repo khong ton tai/khong truy cap duoc.
- GitHub App chua cai hoac auth sai.
- GitHub rate limit.
- Plugin sync rate limit/in progress/lease lost.
- Plugin suspended/stale version.
- Plugin collection quota exceeded.

### Data Quality

Generic message `Data Quality run failed during execution` chua cho user biet permission, SQL, type mismatch hay timeout. Bo sung structured cause, nhung khong lo SQL nhay cam hoac data mau.

## 15. Ke hoach thuc thi

### MVP - Bat buoc de release

1. Rotate/revoke tat ca secret da lo.
2. Sua import P0 va dua web lint/type-check/test/build ve xanh.
3. Khoa Facebook permission/cursor/redaction behavior bang test.
4. Sua cac hardcoded UI quan trong va raw-error override.
5. Tach unit test khoi dependency `localhost:3000` va iframe loading.
6. Review changeset `#8` theo release policy.
7. Phan loai dirty worktree va commit theo scope, khong gom thay doi la.

### V1 - Reliability

1. Structured operational error envelope backward-compatible.
2. Central frontend error localizer.
3. Google OAuth/reconnect mapping.
4. Validation UI cho connected fields va duplicate headers.
5. Admicro production E2E voi credential do user nhap truc tiep.
6. Billing/cancellation/cursor integration tests.

### Future - Mo rong sau reliability gate

1. Redis-backed nonce store cho Admicro horizontal scaling.
2. Versioned provider error taxonomy.
3. Dynamic connector metadata translation co review/versioning.
4. Dedicated integration environment cho browser, backend va provider fixtures.
5. Observability dashboard cho retry, latency, Chromium resource va provider error rate.

## 16. Lenh validation bat buoc

Chay targeted tests trong luc sua, sau do chay day du:

```powershell
npm run check:i18n -w @owox/web
npm run format:check -w @owox/web
npm run lint -w @owox/web
npm run type-check -w @owox/web
npm run test -w @owox/web
npm run build -w @owox/web
npm run test -w @owox/connectors
npm test --prefix apps/admicro-extractor
npm run test -w @owox/backend
git diff --check
```

Khong them `--runInBand` cho Vitest; version hien tai khong ho tro option do. Jest backend co the dung `--runInBand` khi can.

Kiem tra secret:

```powershell
rg -n --hidden -g '!node_modules' -g '!package-lock.json' `
  'access_token=|client_secret|app_secret|password|cookie|authorization|EA[A-Za-z0-9_-]{20,}' .
```

Moi match phai duoc review; fixture synthetic co the chap nhan neu ro rang va khong trung credential that.

## 17. Acceptance checklist

- [ ] Khong con import P0.
- [ ] Web lint pass, 0 warning/error.
- [ ] Web type-check pass.
- [ ] Web full test pass.
- [ ] Web production build pass.
- [ ] Backend relevant va full test pass.
- [ ] Connector test pass.
- [ ] Admicro extractor test pass.
- [ ] EN/VI key sync va khong co duplicate JSON key.
- [ ] Facebook all-account permission failure khong advance cursor.
- [ ] Facebook partial failure khong lam mat du lieu account con lai.
- [ ] Provider secret va ID khong xuat hien trong UI/log/metadata.
- [ ] Credential van project-scoped va connector-scoped.
- [ ] Preview/retry/cancellation khong charge billing.
- [ ] Successful connector run chi charge mot lan.
- [ ] Empty result va global auth failure duoc phan biet.
- [ ] Admicro sidecar chi private, HMAC hoat dong, browser dong sau job.
- [ ] Data Mart cu va connector bi an van doc/chay duoc.
- [ ] Changeset dung GitHub Issue ID va release bump policy.
- [ ] Diff da duoc phan loai; khong commit file audit/temp neu khong can.
- [ ] Production smoke va rollback image SHA duoc xac nhan truoc promotion.

## 18. Mau prompt giao cho AI

```text
Doc toan bo AI_BUG_REMEDIATION_HANDOFF.md va cac tai lieu bat buoc no tham chieu.
Sua loi theo thu tu P0, MVP, V1; khong lam Future neu chua duoc yeu cau.

Worktree dang co nhieu thay doi cua nguoi dung. Khong reset, checkout, xoa, ghi de
hoac commit thay doi khong thuoc task. Truoc moi edit, doc current diff cua file.

Tuyet doi khong dung lai credential da xuat hien trong chat. Khong ghi secret,
provider ID, project ID, credential ID hoac raw provider payload vao log/test/commit.

Bao toan tenant isolation, cursor semantics va billing semantics duoc mo ta trong
tai lieu. Chay targeted test sau moi nhom, sau do chay tat ca release gates.

Bao cao findings con lai truoc. Chi commit/push/deploy khi tat ca acceptance checks
bat buoc da xanh va nguoi dung da yeu cau ro.
```
