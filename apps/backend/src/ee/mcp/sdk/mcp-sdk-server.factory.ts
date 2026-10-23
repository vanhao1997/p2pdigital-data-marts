import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  McpServer,
  type StandardSchemaWithJSON,
  type ServerContext,
} from '@modelcontextprotocol/server';
import type { ToolAnnotations } from '@modelcontextprotocol/server';
import type { McpScope } from '@owox/idp-protocol';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import type { ZodRawShape } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  MCP_PROJECT_CONTEXT_FACADE,
  type McpProjectContextFacade,
} from '../../../idp/facades/mcp-project-context.facade';
import type { McpAuthContext } from '../auth/mcp-auth-context';
import { McpConfigService } from '../config/mcp.config';
import { McpCallInstrumentation } from '../observability/mcp-call-instrumentation';
import {
  jsonToolResult,
  type McpToolDefinition,
  type McpToolResult,
} from '../tools/mcp-tool.definition';
import { McpToolRegistry } from '../tools/mcp-tool.registry';

type McpSdkToolRegistrar = {
  registerTool(
    name: string,
    config: {
      description: string;
      inputSchema: StandardSchemaWithJSON;
      outputSchema?: StandardSchemaWithJSON;
      annotations?: ToolAnnotations;
    },
    callback: (input: unknown, extra: ServerContext) => Promise<McpToolResult>
  ): unknown;
  registerPrompt?(
    name: string,
    config: {
      title?: string;
      description?: string;
      argsSchema?: StandardSchemaWithJSON;
    },
    callback: (
      args: Record<string, string | undefined>,
      extra: ServerContext
    ) => Promise<McpPromptResult> | McpPromptResult
  ): unknown;
};

export type McpPromptResult = {
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
};

export type McpBuiltinPromptDefinition = {
  name: string;
  title: string;
  description: string;
  argsSchema: ZodRawShape;
  buildText: (args: Record<string, string | undefined>, context: McpAuthContext) => string;
};

const PROJECT_ID_FIELD_DESCRIPTION =
  'Optional project name or project ID (e.g. "Selavia Phú Quốc", "M Riverside", "P2P Digital", or UUID) to target a specific project in the webapp, or "all" ("tất cả") to list/search across all projects. Omit to use the default project or auto-resolve from the resource name/ID.';

const PROJECT_NAME_FIELD_DESCRIPTION =
  'Optional project name (e.g. "Selavia Phú Quốc", "M Riverside", "P2P Digital") — Brand teams can pass the project name directly without knowing the technical project ID.';

function normalizeLookupText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isAllProjectsKeyword(value: string | undefined): boolean {
  if (!value) return false;
  const norm = normalizeLookupText(value);
  return (
    norm === 'all' ||
    norm === '*' ||
    norm === 'tat ca' ||
    norm === 'toan bo' ||
    norm === 'all_projects' ||
    norm === 'tat ca du an' ||
    norm === 'toan bo du an'
  );
}

export const MCP_BUILTIN_PROMPTS: readonly McpBuiltinPromptDefinition[] = [
  {
    name: 'phan-tich-hieu-qua-chien-dich',
    title: '📊 Phân tích hiệu quả chiến dịch quảng cáo (Theo Tên Dự Án)',
    description:
      'Truy vấn Data Mart hiệu quả chiến dịch theo Tên dự án (ví dụ: "Selavia Phú Quốc", "M Riverside", "P2P Digital") hoặc toàn bộ Webapp, xếp hạng theo Chi tiêu, Kết quả, Tỷ lệ chuyển đổi và Chi phí/Kết quả (CPR), đồng thời đề xuất tối ưu ngân sách.',
    argsSchema: {
      ten_du_an: z
        .string()
        .optional()
        .describe(
          'Tên dự án cần phân tích (ví dụ: "Selavia Phú Quốc", "M Riverside", "P2P Digital", hoặc "tất cả" — không cần biết ID)'
        ),
      project_id: z
        .string()
        .optional()
        .describe('Tên dự án hoặc ID dự án (tùy chọn, để trống sẽ tìm trên toàn bộ Webapp)'),
      data_mart_name: z
        .string()
        .optional()
        .describe(
          'Tên hoặc từ khóa của Data Mart chiến dịch (tùy chọn, mặc định tự động tìm trong dự án)'
        ),
      thoi_gian: z
        .string()
        .optional()
        .describe('Khoảng thời gian cần phân tích (ví dụ: 7 ngày qua, 30 ngày qua, tất cả)'),
    },
    buildText: (args, _context) => {
      const projectTarget = args.ten_du_an || args.project_id;
      const projectScope = projectTarget
        ? `dự án "${projectTarget}"`
        : 'toàn bộ các dự án trên Webapp';
      const targetHint = args.data_mart_name
        ? `ưu tiên tìm Data Mart khớp với tên "${args.data_mart_name}"`
        : 'tự động tìm Data Mart báo cáo hiệu quả chiến dịch quảng cáo trong dự án';
      const timeHint = args.thoi_gian
        ? `trong khoảng thời gian "${args.thoi_gian}"`
        : 'trên toàn bộ dữ liệu hiện có';
      return [
        `Hãy thực hiện phân tích chuyên sâu hiệu quả chiến dịch quảng cáo cho ${projectScope} ${timeHint} (lưu ý: người dùng là Brand Team nên làm việc hoàn toàn theo Tên dự án và Tên bảng dữ liệu, không yêu cầu người dùng cung cấp ID):`,
        `1. Gọi get_project_context (hoặc list_projects) với project_name="${projectTarget || ''}" để tự động ánh xạ tên dự án, và tìm Data Mart phù hợp (${targetHint}) bằng get_relevant_data_marts_by_prompt hoặc list_data_marts.`,
        `2. Gọi get_data_mart_details_by_id để lấy chính xác tên các trường dữ liệu, sau đó dùng query_data_mart để truy vấn số liệu.`,
        `3. Lập bảng xếp hạng đầy đủ các chiến dịch theo: Chi tiêu (Spend), Lượt hiển thị (Impressions), Tiếp cận (Reach), Tần suất (Frequency), Tổng Kết quả (Results), Tỷ lệ Kết quả (%), và Chi phí / Kết quả (CPR).`,
        `4. Đánh giá chi tiết: (a) Chiến dịch hiệu quả nhất (CPR tối ưu, nhiều kết quả), (b) Chiến dịch đang lãng phí ngân sách, và (c) Đề xuất hành động tối ưu & phân bổ lại ngân sách cụ thể cho Brand Team.`,
      ].join('\n');
    },
  },
  {
    name: 'tao-bao-cao-google-sheets',
    title: '📈 Tạo Data Mart SQL & Xuất báo cáo ra Google Sheets (Theo Tên Dự Án)',
    description:
      'Tạo hoặc chọn Data Mart theo Tên dự án (ví dụ: "Selavia Phú Quốc", "M Riverside"), thiết lập Báo cáo kết nối với Google Sheets, chạy đồng bộ ngay lập tức và trả về link bảng tính.',
    argsSchema: {
      ten_du_an: z
        .string()
        .optional()
        .describe('Tên dự án cần thao tác (ví dụ: "Selavia Phú Quốc", "M Riverside", "P2P Digital")'),
      project_id: z
        .string()
        .optional()
        .describe('Tên dự án hoặc ID dự án (tùy chọn, để trống dùng dự án hiện tại)'),
      chu_de_bao_cao: z
        .string()
        .optional()
        .describe('Chủ đề hoặc tên báo cáo cần xuất (ví dụ: Báo cáo Hiệu quả Chiến dịch)'),
      spreadsheet_id_hoac_url: z
        .string()
        .optional()
        .describe(
          'URL hoặc Spreadsheet ID của file Google Sheets đích (tùy chọn, để trống sẽ dùng Destination có sẵn)'
        ),
      ten_sheet: z
        .string()
        .optional()
        .describe('Tên tab (Sheet title) trong Google Sheets để ghi dữ liệu (tùy chọn)'),
    },
    buildText: (args, _context) => {
      const targetProject = args.ten_du_an || args.project_id || 'dự án hiện tại';
      const topic = args.chu_de_bao_cao || 'Báo cáo Hiệu quả Chiến dịch';
      const sheetTarget = args.spreadsheet_id_hoac_url
        ? `vào Google Sheets "${args.spreadsheet_id_hoac_url}"`
        : 'sử dụng Google Sheets Destination đang được kết nối sẵn trong dự án';
      const tabHint = args.ten_sheet ? ` (tên tab/sheet: "${args.ten_sheet}")` : '';
      return [
        `Hãy giúp tôi tạo hoặc xuất báo cáo "${topic}" ra Google Sheets cho dự án "${targetProject}" ${sheetTarget}${tabHint} (tự động tra cứu theo Tên dự án và Tên Data Mart, không hỏi ID kỹ thuật):`,
        `1. Gọi get_project_context, list_data_marts và get_data_mart_reports với project_name="${targetProject}" để kiểm tra xem Data Mart và Báo cáo Google Sheets cho chủ đề "${topic}" đã tồn tại hay chưa.`,
        `2. Nếu chưa có Data Mart phù hợp, hãy kiểm tra kho dữ liệu bằng list_data_storages, tạo bản nháp SQL Data Mart với tên cột Tiếng Việt thân thiện (create_data_mart / update_data_mart), kiểm tra hợp lệ bằng validate_data_mart và hỏi ý kiến tôi trước khi publish_data_mart.`,
        `3. Nếu đã có Data Mart PUBLISHED, hãy tạo báo cáo mới bằng add_report (hoặc chạy lại báo cáo hiện có bằng run_report), theo dõi tiến trình bằng get_report_run_status cho đến khi should_poll=false, và gửi lại đường dẫn Google Sheets hoàn chỉnh.`,
      ].join('\n');
    },
  },
  {
    name: 'tao-bao-cao-looker-studio',
    title: '📊 Tạo & Kết nối Báo cáo Google Data Studio / Looker Studio (Theo Tên Dự Án)',
    description:
      'Tạo hoặc bật báo cáo Google Data Studio (Looker Studio) cho một hoặc toàn bộ Data Mart trong dự án theo Tên dự án, tự động khởi tạo Looker Studio Destination nếu chưa có và trả về link Partner Connector kèm 4 mẫu Dashboard.',
    argsSchema: {
      ten_du_an: z
        .string()
        .optional()
        .describe('Tên dự án mục tiêu (ví dụ: "Nomura", "Selavia Phú Quốc", "M Riverside", "P2P Digital")'),
      project_id: z
        .string()
        .optional()
        .describe('Tên dự án hoặc ID dự án (tùy chọn)'),
      ten_data_mart: z
        .string()
        .optional()
        .describe('Tên Data Mart cần tạo báo cáo Looker Studio (để trống hoặc "tất cả" để bật cho mọi Data Mart đã xuất bản trong dự án)'),
    },
    buildText: (args, _context) => {
      const targetProject = args.ten_du_an || args.project_id || 'dự án hiện tại';
      const dmTarget = args.ten_data_mart
        ? `cho Data Mart "${args.ten_data_mart}"`
        : 'cho toàn bộ các Data Mart đã xuất bản (PUBLISHED)';
      return [
        `Hãy tạo và kích hoạt báo cáo Google Data Studio (Looker Studio) ${dmTarget} thuộc dự án "${targetProject}" (project_name: "${targetProject}"):`,
        `1. Gọi create_looker_studio_report (hoặc list_destinations -> add_destination(destination_type="looker_studio") -> add_report) với project_name="${targetProject}".`,
        `2. Trả về danh sách các báo cáo Looker Studio đã được kích hoạt, đường dẫn cấu hình JSON Config của Destination trên Web UI, link trực tiếp Google Looker Studio Partner Connector và 4 mẫu Dashboard Looker Studio dựng sẵn.`,
      ].join('\n');
    },
  },
  {
    name: 'dat-lich-chay-bao-cao-tu-dong',
    title: '⏰ Đặt lịch tự động cập nhật báo cáo hàng ngày (Theo Tên Dự Án)',
    description:
      'Thiết lập lịch chạy tự động (Schedule/Trigger) cho báo cáo Google Sheets theo Tên dự án và Tên báo cáo, múi giờ Việt Nam (Asia/Ho_Chi_Minh).',
    argsSchema: {
      ten_du_an: z
        .string()
        .optional()
        .describe('Tên dự án chứa báo cáo cần đặt lịch (ví dụ: "Selavia Phú Quốc", "M Riverside")'),
      project_id: z
        .string()
        .optional()
        .describe('Tên dự án hoặc ID dự án chứa báo cáo cần đặt lịch (tùy chọn)'),
      ten_bao_cao_hoac_data_mart: z
        .string()
        .optional()
        .describe(
          'Tên Báo cáo hoặc Data Mart cần đặt lịch (tùy chọn, để trống sẽ kiểm tra các báo cáo hiện có)'
        ),
      gio_chay: z
        .string()
        .optional()
        .describe('Giờ chạy hàng ngày theo định dạng HH:mm (mặc định: 08:00 sáng giờ Việt Nam)'),
    },
    buildText: (args, _context) => {
      const targetProject = args.ten_du_an || args.project_id || 'dự án hiện tại';
      const target = args.ten_bao_cao_hoac_data_mart
        ? `cho báo cáo/Data Mart "${args.ten_bao_cao_hoac_data_mart}"`
        : 'cho báo cáo Google Sheets trong dự án';
      const time = args.gio_chay || '08:00';
      return [
        `Hãy thiết lập lịch tự động cập nhật báo cáo hàng ngày ${target} trong dự án "${targetProject}" (tự động tìm theo tên dự án và tên báo cáo, không hỏi ID kỹ thuật):`,
        `1. Gọi list_data_marts và get_data_mart_reports với project_name="${targetProject}" để tự động tìm báo cáo và kiểm tra các lịch chạy (schedules) hiện có.`,
        `2. Sử dụng create_report_run_schedule (hoặc update_report_run_schedule nếu đã có lịch) để đặt lịch chạy tự động hàng ngày vào lúc ${time} theo múi giờ Asia/Ho_Chi_Minh.`,
        `3. Xác nhận lại chi tiết cấu hình lịch chạy (Tên dự án, Tên báo cáo, tần suất, múi giờ) sau khi hoàn tất.`,
      ].join('\n');
    },
  },
  {
    name: 'kiem-tra-suc-khoe-du-lieu',
    title: '🔍 Kiểm tra tổng quan & sức khỏe dữ liệu theo Tên Dự Án hoặc Toàn Webapp',
    description:
      'Kiểm tra dự án theo Tên dự án (ví dụ: "Selavia Phú Quốc", "M Riverside") hoặc toàn bộ Webapp: Data Marts, kho dữ liệu BigQuery, kết nối Connector, báo cáo Google Sheets và trạng thái các lần chạy gần nhất.',
    argsSchema: {
      ten_du_an: z
        .string()
        .optional()
        .describe('Tên dự án cần kiểm tra, hoặc "tất cả" để kiểm tra toàn bộ Webapp (mặc định: tất cả)'),
      project_id: z
        .string()
        .optional()
        .describe('Tên dự án hoặc ID dự án cần kiểm tra, hoặc "all" (mặc định: all)'),
      chi_tiet: z
        .string()
        .optional()
        .describe('Phạm vi kiểm tra (ví dụ: tat-ca, bao-cao, connector)'),
    },
    buildText: (args, _context) => {
      const rawTarget = args.ten_du_an || args.project_id;
      const projectTarget =
        rawTarget && !isAllProjectsKeyword(rawTarget)
          ? `dự án "${rawTarget}"`
          : 'toàn bộ các dự án trên Webapp (project_id="all")';
      const scopeHint = args.chi_tiet ? ` (trọng tâm: ${args.chi_tiet})` : '';
      return [
        `Hãy kiểm tra tổng quan và đánh giá sức khỏe dữ liệu cho ${projectTarget}${scopeHint} (hiển thị rõ theo Tên dự án thân thiện cho Brand Team):`,
        `1. Gọi list_projects và get_project_context để liệt kê các dự án theo tên, sau đó gọi list_data_marts và list_data_storages.`,
        `2. Với các Data Mart hiện có, gọi get_data_mart_setup_status và get_data_mart_reports để kiểm tra trạng thái xuất bản (PUBLISHED/DRAFT), lần chạy gần nhất và các báo cáo Google Sheets đi kèm.`,
        `3. Tổng hợp báo cáo sức khỏe dữ liệu rõ ràng theo từng Tên dự án gồm: (a) Tên dự án & Kho dữ liệu BigQuery, (b) Danh sách Data Marts & số trường dữ liệu, (c) Danh sách Báo cáo Google Sheets & lịch chạy tự động, (d) Các lỗi hoặc cảnh báo cần chú ý.`,
      ].join('\n');
    },
  },
  {
    name: 'tao-data-mart-tu-connector',
    title: '🔌 Tạo Data Mart mới từ Connector theo Tên Dự Án (Facebook Ads, Google Ads, TikTok, LinkedIn...)',
    description:
      'Khởi tạo bản nháp Data Mart thu thập dữ liệu từ các nền tảng quảng cáo/kinh doanh theo Tên dự án mà không cần biết ID dự án.',
    argsSchema: {
      ten_du_an: z
        .string()
        .optional()
        .describe(
          'Tên dự án muốn tạo Data Mart (ví dụ: "Selavia Phú Quốc", "M Riverside", "P2P Digital")'
        ),
      project_id: z
        .string()
        .optional()
        .describe('Tên dự án hoặc ID dự án muốn tạo Data Mart (tùy chọn)'),
      nen_tang: z
        .string()
        .optional()
        .describe(
          'Tên nền tảng cần kết nối (ví dụ: Facebook Ads, Google Ads, Google Analytics 4, TikTok Ads, TikTok GMV Max, LinkedIn Ads, LinkedIn Pages)'
        ),
      ten_data_mart: z
        .string()
        .optional()
        .describe('Tên dự kiến cho Data Mart mới (tùy chọn)'),
    },
    buildText: (args, _context) => {
      const targetProject = args.ten_du_an || args.project_id || 'dự án hiện tại';
      const platform = args.nen_tang || 'nền tảng quảng cáo/kinh doanh';
      const titleHint = args.ten_data_mart ? ` với tên "${args.ten_data_mart}"` : '';
      return [
        `Hãy hướng dẫn và khởi tạo bản nháp Data Mart thu thập dữ liệu từ Connector "${platform}"${titleHint} cho dự án "${targetProject}" (tự động tìm dự án và kho BigQuery theo tên, không yêu cầu Brand Team cung cấp ID):`,
        `1. Gọi list_projects, list_data_storages và list_connectors với project_name="${targetProject}" để tự động chọn đúng dự án và tìm Connector tương ứng với "${platform}".`,
        `2. Gọi get_connector_specification và get_connector_fields để lấy danh sách node và các trường dữ liệu chuẩn xác.`,
        `3. Hỏi tôi xác nhận Tên dự án và bảng đích BigQuery (fully_qualified_name) nếu cần, sau đó khởi tạo DRAFT bằng create_connector / configure_connector và gửi đường dẫn cấu hình xác thực an toàn trên giao diện Web.`,
      ].join('\n');
    },
  },
];

@Injectable()
export class McpSdkServerFactory {
  private readonly schemaCache = new WeakMap<ZodRawShape, StandardSchemaWithJSON>();
  private readonly inputSchemaCache = new WeakMap<ZodRawShape, StandardSchemaWithJSON>();
  private readonly promptSchemaCache = new WeakMap<ZodRawShape, StandardSchemaWithJSON>();

  constructor(
    private readonly config: McpConfigService,
    private readonly toolRegistry: McpToolRegistry,
    private readonly instrumentation: McpCallInstrumentation,
    @Optional()
    @Inject(MCP_PROJECT_CONTEXT_FACADE)
    private readonly projectContextFacade?: McpProjectContextFacade,
    @Optional()
    private readonly dataSource?: DataSource
  ) {}

  create(mcpContext: McpAuthContext, instructions?: string): McpServer {
    const serverInfo = {
      name: this.config.serverName,
      version: this.config.serverVersion,
    };
    const server = new McpServer(serverInfo, {
      ...(instructions ? { instructions } : {}),
      // Keep the deployed legacy revisions while explicitly enabling the 2026 modern era.
      supportedProtocolVersions: [
        '2026-07-28',
        '2025-11-25',
        '2025-06-18',
        '2025-03-26',
        '2024-11-05',
        '2024-10-07',
      ],
      capabilities: {
        tools: { listChanged: false },
        prompts: { listChanged: false },
      },
      cacheHints: {
        'server/discover': { ttlMs: 0, cacheScope: 'private' },
        'tools/list': { ttlMs: 0, cacheScope: 'private' },
        'prompts/list': { ttlMs: 0, cacheScope: 'private' },
      },
    });

    const sdkToolRegistrar = server as unknown as McpSdkToolRegistrar;

    for (const tool of [...this.toolRegistry.getTools()].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    )) {
      const wrapped = this.instrumentation.wrap(tool.name, async (input, extra) => {
        this.assertScopes(mcpContext, tool.requiredScopes);
        const inputObj =
          typeof input === 'object' && input !== null && !Array.isArray(input)
            ? (input as Record<string, unknown>)
            : undefined;
        const rawProjectName =
          typeof inputObj?.project_name === 'string' && inputObj.project_name.trim().length > 0
            ? inputObj.project_name.trim()
            : undefined;
        const rawProjectId =
          rawProjectName ??
          (typeof inputObj?.project_id === 'string' && inputObj.project_id.trim().length > 0
            ? inputObj.project_id.trim()
            : undefined);

        const toolDeclaresProjectId = Object.prototype.hasOwnProperty.call(
          tool.zodSchema,
          'project_id'
        );
        const toolDeclaresProjectName = Object.prototype.hasOwnProperty.call(
          tool.zodSchema,
          'project_name'
        );

        let cleanInput: unknown = input;
        if (inputObj) {
          const strippedEntries = Object.entries(inputObj).filter(([k]) => {
            if (k === 'project_id' && !toolDeclaresProjectId) return false;
            if (k === 'project_name' && !toolDeclaresProjectName) return false;
            return true;
          });
          cleanInput = Object.fromEntries(strippedEntries);
        }

        if (isAllProjectsKeyword(rawProjectId) && this.isMultiProjectCatalogTool(tool.name)) {
          return this.executeAcrossAllProjects(tool, cleanInput, mcpContext, extra?.signal);
        }

        const { effectiveContext, resolvedInput } = await this.resolveEffectiveContextAndInput(
          mcpContext,
          rawProjectId,
          cleanInput,
          toolDeclaresProjectId
        );
        // extra.signal fires on client disconnect/cancel — thread it so an abandoned query stops
        // waiting and is recorded CANCELLED (not billed) instead of running to completion.
        const primaryResult = await tool.handler(resolvedInput, effectiveContext, extra?.signal);

        if (
          !rawProjectId &&
          tool.name === 'get_relevant_data_marts_by_prompt' &&
          this.isEmptyDataMartsResult(primaryResult) &&
          typeof this.projectContextFacade?.listProjectsForUser === 'function'
        ) {
          return this.executeAcrossAllProjects(tool, resolvedInput, mcpContext, extra?.signal);
        }

        return primaryResult;
      });

      const augmentedInputShape = this.withOptionalProjectSelectors(tool.zodSchema);

      sdkToolRegistrar.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: this.toStandardSchema(augmentedInputShape, true),
          ...(tool.outputSchema ? { outputSchema: this.toStandardSchema(tool.outputSchema) } : {}),
          ...(tool.annotations ? { annotations: tool.annotations } : {}),
        },
        (input, ctx) =>
          wrapped(input, {
            signal: ctx?.mcpReq.signal,
            _meta: ctx?.mcpReq._meta,
          })
      );
    }

    if (typeof sdkToolRegistrar.registerPrompt === 'function') {
      for (const prompt of MCP_BUILTIN_PROMPTS) {
        sdkToolRegistrar.registerPrompt(
          prompt.name,
          {
            title: prompt.title,
            description: prompt.description,
            argsSchema: this.toPromptStandardSchema(prompt.argsSchema),
          },
          async args => {
            this.assertScopes(mcpContext, ['mcp:read']);
            return {
              description: prompt.description,
              messages: [
                {
                  role: 'user',
                  content: {
                    type: 'text',
                    text: prompt.buildText(args ?? {}, mcpContext),
                  },
                },
              ],
            };
          }
        );
      }
    }

    return server;
  }

  private withOptionalProjectSelectors(shape: ZodRawShape): ZodRawShape {
    const nextShape: ZodRawShape = { ...shape };
    if (!Object.prototype.hasOwnProperty.call(nextShape, 'project_id')) {
      nextShape.project_id = z.string().optional().describe(PROJECT_ID_FIELD_DESCRIPTION);
    }
    if (!Object.prototype.hasOwnProperty.call(nextShape, 'project_name')) {
      nextShape.project_name = z.string().optional().describe(PROJECT_NAME_FIELD_DESCRIPTION);
    }
    return nextShape;
  }

  private isMultiProjectCatalogTool(toolName: string): boolean {
    return (
      toolName === 'list_data_marts' ||
      toolName === 'get_relevant_data_marts_by_prompt' ||
      toolName === 'summarize_data_catalog' ||
      toolName === 'list_data_storages' ||
      toolName === 'list_destinations'
    );
  }

  private isEmptyDataMartsResult(result: McpToolResult): boolean {
    const sc = result?.structuredContent as { data_marts?: unknown[] } | undefined;
    return Array.isArray(sc?.data_marts) && sc.data_marts.length === 0;
  }

  private async executeAcrossAllProjects(
    tool: McpToolDefinition,
    cleanInput: unknown,
    mcpContext: McpAuthContext,
    signal?: AbortSignal
  ): Promise<McpToolResult> {
    const projects =
      typeof this.projectContextFacade?.listProjectsForUser === 'function'
        ? await this.projectContextFacade.listProjectsForUser(mcpContext.userId).catch(() => [])
        : [];
    if (projects.length <= 1) {
      return tool.handler(cleanInput, mcpContext, signal);
    }

    const perProjectResults = await Promise.all(
      projects.map(async proj => {
        const projContext: McpAuthContext = {
          ...mcpContext,
          projectId: proj.id,
          roles: proj.roles && proj.roles.length > 0 ? proj.roles : mcpContext.roles,
        };
        try {
          const res = await tool.handler(cleanInput, projContext, signal);
          return { project: proj, structured: res.structuredContent as Record<string, unknown> };
        } catch {
          return null;
        }
      })
    );

    const valid = perProjectResults.filter(
      (item): item is NonNullable<typeof item> => item !== null && Boolean(item.structured)
    );
    if (valid.length === 0) {
      return tool.handler(cleanInput, mcpContext, signal);
    }

    if (tool.name === 'list_data_marts' || tool.name === 'get_relevant_data_marts_by_prompt') {
      const mergedDataMarts = valid.flatMap(({ project, structured }) => {
        const list = Array.isArray(structured.data_marts)
          ? (structured.data_marts as Array<Record<string, unknown>>)
          : [];
        return list.map(dm => ({
          ...dm,
          description: `[Dự án: ${project.title}]${dm.description ? ` ${String(dm.description)}` : ''}`,
        }));
      });
      return jsonToolResult({
        project: { id: 'all', title: `All Projects (${valid.length})` },
        data_marts: mergedDataMarts,
      });
    }

    if (tool.name === 'summarize_data_catalog') {
      const mergedTop = valid.flatMap(({ project, structured }) => {
        const list = Array.isArray(structured.top_data_marts_by_connectivity)
          ? (structured.top_data_marts_by_connectivity as Array<Record<string, unknown>>)
          : [];
        return list.map(dm => ({
          ...dm,
          description: `[Dự án: ${project.title}]${dm.description ? ` ${String(dm.description)}` : ''}`,
        }));
      });
      const totalCount = valid.reduce(
        (sum, { structured }) =>
          sum + (typeof structured.data_mart_count === 'number' ? structured.data_mart_count : 0),
        0
      );
      return jsonToolResult({
        project: { id: 'all', title: `All Projects (${valid.length})` },
        project_id: 'all',
        data_mart_count: totalCount,
        top_data_marts_by_connectivity: mergedTop,
        _instruction:
          typeof valid[0].structured._instruction === 'string'
            ? valid[0].structured._instruction
            : '',
      });
    }

    if (tool.name === 'list_data_storages') {
      const mergedStorages = valid.flatMap(({ project, structured }) => {
        const list = Array.isArray(structured.storages)
          ? (structured.storages as Array<Record<string, unknown>>)
          : [];
        return list.map(st => ({
          ...st,
          title: `${String(st.title ?? '')} [Dự án: ${project.title}]`,
        }));
      });
      return jsonToolResult({
        project: { id: 'all', title: `All Projects (${valid.length})` },
        storages: mergedStorages,
      });
    }

    if (tool.name === 'list_destinations') {
      const mergedDestinations = valid.flatMap(({ project, structured }) => {
        const list = Array.isArray(structured.destinations)
          ? (structured.destinations as Array<Record<string, unknown>>)
          : [];
        return list.map(dest => ({
          ...dest,
          title: `${String(dest.title ?? '')} [Dự án: ${project.title}]`,
        }));
      });
      return jsonToolResult({
        project: { id: 'all', title: `All Projects (${valid.length})` },
        destinations: mergedDestinations,
      });
    }

    return tool.handler(cleanInput, mcpContext, signal);
  }

  private async resolveProjectSelectorToId(
    userId: string,
    rawSelector: string
  ): Promise<string> {
    const projects =
      typeof this.projectContextFacade?.listProjectsForUser === 'function'
        ? await this.projectContextFacade.listProjectsForUser(userId).catch(() => [])
        : [];
    if (projects.length > 0) {
      const needle = normalizeLookupText(rawSelector);
      const matched =
        projects.find(p => p.id === rawSelector) ??
        projects.find(p => p.id.toLowerCase() === rawSelector.toLowerCase()) ??
        projects.find(p => normalizeLookupText(p.title) === needle) ??
        projects.find(
          p =>
            normalizeLookupText(p.title).includes(needle) ||
            needle.includes(normalizeLookupText(p.title))
        );
      if (matched) {
        return matched.id;
      }
    }
    return rawSelector;
  }

  private async resolveEffectiveContextAndInput(
    mcpContext: McpAuthContext,
    rawProjectSelector: string | undefined,
    cleanInput: unknown,
    toolDeclaresProjectId: boolean
  ): Promise<{ effectiveContext: McpAuthContext; resolvedInput: unknown }> {
    let targetProjectId =
      rawProjectSelector && !isAllProjectsKeyword(rawProjectSelector)
        ? await this.resolveProjectSelectorToId(mcpContext.userId, rawProjectSelector)
        : undefined;

    const { updatedInput, detectedProjectId } = await this.resolveResourceInputsAndProjectId(
      cleanInput,
      targetProjectId
    );
    if (!targetProjectId && detectedProjectId) {
      targetProjectId = detectedProjectId;
    }

    let finalInput = updatedInput;
    if (
      toolDeclaresProjectId &&
      targetProjectId &&
      typeof finalInput === 'object' &&
      finalInput !== null &&
      !Array.isArray(finalInput)
    ) {
      finalInput = {
        ...(finalInput as Record<string, unknown>),
        project_id: targetProjectId,
      };
    }

    if (!targetProjectId || targetProjectId === mcpContext.projectId) {
      return { effectiveContext: mcpContext, resolvedInput: finalInput };
    }

    if (this.projectContextFacade) {
      const resolved = await this.projectContextFacade.getProjectContext({
        userId: mcpContext.userId,
        projectId: targetProjectId,
        roles: mcpContext.roles,
      });
      return {
        effectiveContext: {
          ...mcpContext,
          projectId: resolved.project.id,
          roles:
            resolved.project.roles && resolved.project.roles.length > 0
              ? resolved.project.roles
              : mcpContext.roles,
        },
        resolvedInput: finalInput,
      };
    }

    return {
      effectiveContext: {
        ...mcpContext,
        projectId: targetProjectId,
      },
      resolvedInput: finalInput,
    };
  }

  private async resolveResourceInputsAndProjectId(
    input: unknown,
    preferredProjectId?: string
  ): Promise<{ updatedInput: unknown; detectedProjectId?: string }> {
    if (!this.dataSource?.isInitialized || typeof input !== 'object' || input === null) {
      return { updatedInput: input };
    }
    const obj = { ...(input as Record<string, unknown>) };
    let detectedProjectId: string | undefined;

    try {
      if (typeof obj.data_mart_id === 'string' && obj.data_mart_id.trim()) {
        const rawDm = obj.data_mart_id.trim();
        const exactRows = (await this.dataSource.query(
          'SELECT id, projectId FROM data_mart WHERE id = ? LIMIT 1',
          [rawDm]
        )) as Array<{ id?: string; projectId?: string }>;
        if (exactRows[0]?.projectId) {
          detectedProjectId = exactRows[0].projectId;
        } else {
          const allRows = (await this.dataSource.query(
            'SELECT id, title, projectId FROM data_mart'
          )) as Array<{ id: string; title: string; projectId: string }>;
          const needle = normalizeLookupText(rawDm);
          const candidates = preferredProjectId
            ? [
                ...allRows.filter(r => r.projectId === preferredProjectId),
                ...allRows.filter(r => r.projectId !== preferredProjectId),
              ]
            : allRows;
          const matched =
            candidates.find(r => normalizeLookupText(r.title) === needle) ??
            candidates.find(
              r =>
                normalizeLookupText(r.title).includes(needle) ||
                needle.includes(normalizeLookupText(r.title))
            );
          if (matched) {
            obj.data_mart_id = matched.id;
            detectedProjectId = matched.projectId;
          }
        }
      }
      if (typeof obj.storage_id === 'string' && obj.storage_id.trim()) {
        const rawStorage = obj.storage_id.trim();
        const exactRows = (await this.dataSource.query(
          'SELECT id, projectId FROM data_storage WHERE id = ? LIMIT 1',
          [rawStorage]
        )) as Array<{ id?: string; projectId?: string }>;
        if (exactRows[0]?.projectId) {
          detectedProjectId = detectedProjectId ?? exactRows[0].projectId;
        } else {
          const allRows = (await this.dataSource.query(
            'SELECT id, title, projectId FROM data_storage'
          )) as Array<{ id: string; title: string; projectId: string }>;
          const needle = normalizeLookupText(rawStorage);
          const candidates = preferredProjectId
            ? allRows.filter(r => r.projectId === preferredProjectId)
            : allRows;
          const matched =
            candidates.find(r => normalizeLookupText(r.title) === needle) ??
            candidates.find(r => normalizeLookupText(r.title).includes(needle)) ??
            (preferredProjectId && candidates.length === 1 ? candidates[0] : undefined);
          if (matched) {
            obj.storage_id = matched.id;
            detectedProjectId = detectedProjectId ?? matched.projectId;
          }
        }
      }
      if (typeof obj.destination_id === 'string' && obj.destination_id.trim()) {
        const rawDest = obj.destination_id.trim();
        const exactRows = (await this.dataSource.query(
          'SELECT id, projectId FROM data_destination WHERE id = ? LIMIT 1',
          [rawDest]
        )) as Array<{ id?: string; projectId?: string }>;
        if (exactRows[0]?.projectId) {
          detectedProjectId = detectedProjectId ?? exactRows[0].projectId;
        } else {
          const allRows = (await this.dataSource.query(
            'SELECT id, title, projectId FROM data_destination'
          )) as Array<{ id: string; title: string; projectId: string }>;
          const needle = normalizeLookupText(rawDest);
          const matched =
            allRows.find(r => normalizeLookupText(r.title) === needle) ??
            allRows.find(r => normalizeLookupText(r.title).includes(needle));
          if (matched) {
            obj.destination_id = matched.id;
            detectedProjectId = detectedProjectId ?? matched.projectId;
          }
        }
      }
      if (typeof obj.report_id === 'string' && obj.report_id.trim()) {
        const rawRep = obj.report_id.trim();
        const exactRows = (await this.dataSource.query(
          'SELECT r.id AS id, dm.projectId AS projectId FROM data_mart_report r INNER JOIN data_mart dm ON dm.id = r.dataMartId WHERE r.id = ? LIMIT 1',
          [rawRep]
        )) as Array<{ id?: string; projectId?: string }>;
        if (exactRows[0]?.projectId) {
          detectedProjectId = detectedProjectId ?? exactRows[0].projectId;
        } else {
          const allRows = (await this.dataSource.query(
            'SELECT r.id AS id, r.title AS title, dm.projectId AS projectId FROM data_mart_report r INNER JOIN data_mart dm ON dm.id = r.dataMartId'
          )) as Array<{ id: string; title: string; projectId: string }>;
          const needle = normalizeLookupText(rawRep);
          const matched =
            allRows.find(r => normalizeLookupText(r.title) === needle) ??
            allRows.find(
              r =>
                normalizeLookupText(r.title).includes(needle) ||
                needle.includes(normalizeLookupText(r.title))
            );
          if (matched) {
            obj.report_id = matched.id;
            detectedProjectId = detectedProjectId ?? matched.projectId;
          }
        }
      }
      if (typeof obj.schedule_id === 'string' && obj.schedule_id.trim()) {
        const rows = (await this.dataSource.query(
          'SELECT projectId FROM scheduled_trigger WHERE id = ? LIMIT 1',
          [obj.schedule_id.trim()]
        )) as Array<{ projectId?: string }>;
        if (rows[0]?.projectId) {
          detectedProjectId = detectedProjectId ?? rows[0].projectId;
        }
      }
    } catch {
      // Fallback to default context if table lookup fails.
    }
    return { updatedInput: obj, detectedProjectId };
  }

  private toPromptStandardSchema(shape: ZodRawShape): StandardSchemaWithJSON {
    const cached = this.promptSchemaCache.get(shape);
    if (cached) return cached;

    const objectSchema = z.object(shape);
    const jsonSchema = zodToJsonSchema(objectSchema as never, {
      target: 'jsonSchema7',
      $refStrategy: 'none',
      strictUnions: true,
      pipeStrategy: 'input',
    });
    const standardSchema: StandardSchemaWithJSON = {
      '~standard': {
        version: 1,
        vendor: 'zod',
        validate: async value => {
          const result = await objectSchema.safeParseAsync(value ?? {});
          return result.success ? { value: result.data } : { issues: result.error.issues };
        },
        jsonSchema: {
          input: () => jsonSchema,
          output: () => jsonSchema,
        },
      },
    };
    this.promptSchemaCache.set(shape, standardSchema);
    return standardSchema;
  }

  private toStandardSchema(shape: ZodRawShape, strictInput = false): StandardSchemaWithJSON {
    const cache = strictInput ? this.inputSchemaCache : this.schemaCache;
    const cached = cache.get(shape);
    if (cached) return cached;

    const objectSchema = strictInput ? z.object(shape).strict() : z.object(shape);
    // Preserve Zod 3 refinements/transforms at the business boundary while exposing SDK v2's
    // Standard Schema interface. Conversion is cached across per-request server instances.
    const jsonSchema = zodToJsonSchema(objectSchema as never, {
      target: 'jsonSchema7',
      $refStrategy: 'none',
      strictUnions: true,
      pipeStrategy: 'input',
    });
    const standardSchema: StandardSchemaWithJSON = {
      '~standard': {
        version: 1,
        vendor: 'zod',
        validate: async value => {
          const result = await objectSchema.safeParseAsync(value);
          return result.success ? { value: result.data } : { issues: result.error.issues };
        },
        jsonSchema: {
          input: () => jsonSchema,
          output: () => jsonSchema,
        },
      },
    };
    cache.set(shape, standardSchema);
    return standardSchema;
  }

  private assertScopes(context: McpAuthContext, requiredScopes: McpScope[]): void {
    for (const scope of requiredScopes) {
      if (!context.scopes.includes(scope)) {
        throw new Error(`Missing MCP scope: ${scope}`);
      }
    }
  }
}
