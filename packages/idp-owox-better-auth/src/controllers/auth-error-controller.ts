import { sendSecureHtml } from '@owox/internal-helpers';
import {
  type Express,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from 'express';
import { AUTH_BASE_PATH } from '../core/constants.js';
import { TemplateService } from '../services/rendering/template-service.js';
import { readQueryString } from '../utils/request-utils.js';

const DEFAULT_AUTH_ERROR_MESSAGE = 'Không thể hoàn tất đăng nhập. Vui lòng thử lại.';

/**
 * Covers OAuth RFC errors, Better Auth callback errors and common provider-specific OAuth errors.
 */
const KNOWN_AUTH_ERROR_MESSAGES: Record<string, string> = {
  // OAuth/OIDC standard errors
  access_denied: 'Quyền truy cập bị từ chối. Vui lòng thử lại và cấp các quyền cần thiết.',
  invalid_request: 'Yêu cầu đăng nhập không hợp lệ. Vui lòng thử lại.',
  unauthorized_client: 'Ứng dụng chưa được cấp quyền cho yêu cầu đăng nhập này.',
  unsupported_response_type: 'Nhà cung cấp danh tính trả về kiểu phản hồi không được hỗ trợ.',
  invalid_scope: 'Các quyền được yêu cầu không hợp lệ hoặc không khả dụng.',
  server_error: 'Nhà cung cấp danh tính gặp lỗi. Vui lòng thử lại sau.',
  temporarily_unavailable: 'Đăng nhập tạm thời không khả dụng. Vui lòng thử lại sau.',
  invalid_client: 'Cấu hình ứng dụng xác thực không hợp lệ.',
  invalid_grant: 'Mã cấp quyền đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.',
  interaction_required: 'Cần thêm thao tác để hoàn tất đăng nhập.',
  login_required: 'Vui lòng đăng nhập để tiếp tục.',
  account_selection_required: 'Vui lòng chọn tài khoản để tiếp tục.',
  consent_required: 'Cần chấp thuận thêm để tiếp tục.',
  admin_consent_required: 'Cần quản trị viên phê duyệt cho lần đăng nhập này.',
  invalid_resource: 'Tài nguyên được yêu cầu không khả dụng cho tài khoản này.',

  // Better Auth callback errors
  signup_disabled: 'Tính năng đăng ký hiện đang bị tắt.',
  account_already_linked_to_different_user:
    'Tài khoản mạng xã hội này đã liên kết với người dùng khác.',
  unable_to_link_account: 'Không thể liên kết tài khoản mạng xã hội. Vui lòng thử lại.',
  unable_to_get_user_info: 'Không thể lấy dữ liệu tài khoản từ nhà cung cấp danh tính.',
  email_doesnt_match: 'Email trả về không khớp với tài khoản dự kiến.',
  email_not_found: 'Nhà cung cấp danh tính không trả về email.',
  oauth_provider_not_found: 'Nhà cung cấp đăng nhập được yêu cầu chưa được cấu hình.',
  no_callback_url: 'Thiếu URL callback đăng nhập.',
  no_code: 'Thiếu mã ủy quyền trong callback.',
  state_mismatch: 'Phát hiện trạng thái đăng nhập không khớp. Vui lòng thử lại.',
  state_not_found: 'Không tìm thấy trạng thái đăng nhập. Vui lòng bắt đầu lại.',
  invalid_callback_request: 'Yêu cầu callback OAuth không hợp lệ.',

  // Common Google and Microsoft provider error hints
  redirect_uri_mismatch: 'Cấu hình URL chuyển hướng xác thực không chính xác.',
  org_internal: 'Lần đăng nhập này chỉ dành cho tài khoản tổ chức.',
  admin_policy_enforced: 'Chính sách tổ chức đã chặn quyền truy cập được yêu cầu.',
  disallowed_useragent: 'Trình duyệt này không được phép dùng cho luồng đăng nhập.',
};

/**
 * Handles rendering of custom auth error page.
 */
export class AuthErrorController {
  constructor(private readonly gtmContainerId?: string) {}

  private resolveErrorMessage(errorCode: string | undefined): string {
    if (errorCode && KNOWN_AUTH_ERROR_MESSAGES[errorCode]) {
      return KNOWN_AUTH_ERROR_MESSAGES[errorCode];
    }
    return DEFAULT_AUTH_ERROR_MESSAGE;
  }

  async errorPage(req: ExpressRequest, res: ExpressResponse): Promise<void> {
    const errorCode = readQueryString(req, 'error');
    const errorMessage = this.resolveErrorMessage(errorCode);

    res.status(400);
    sendSecureHtml(
      res,
      TemplateService.renderAuthError({
        heading: 'Đăng nhập thất bại',
        errorMessage,
        homeHref: '/',
        homeLabel: 'Về trang chủ',
        gtmContainerId: this.gtmContainerId,
      })
    );
  }

  registerRoutes(express: Express): void {
    express.get(`${AUTH_BASE_PATH}/error`, this.errorPage.bind(this));
  }
}
