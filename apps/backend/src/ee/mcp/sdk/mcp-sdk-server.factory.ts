import { Injectable } from '@nestjs/common';
import {
  McpServer,
  type StandardSchemaWithJSON,
  type ServerContext,
} from '@modelcontextprotocol/server';
import type { ToolAnnotations } from '@modelcontextprotocol/server';
import type { McpScope } from '@owox/idp-protocol';
import { z } from 'zod';
import type { ZodRawShape } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { McpAuthContext } from '../auth/mcp-auth-context';
import { McpConfigService } from '../config/mcp.config';
import { McpCallInstrumentation } from '../observability/mcp-call-instrumentation';
import type { McpToolResult } from '../tools/mcp-tool.definition';
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

export const MCP_BUILTIN_PROMPTS: readonly McpBuiltinPromptDefinition[] = [
  {
    name: 'phan-tich-hieu-qua-chien-dich',
    title: '📊 Phân tích hiệu quả chiến dịch quảng cáo',
    description:
      'Truy vấn Data Mart hiệu quả chiến dịch, xếp hạng theo Chi tiêu, Kết quả, Tỷ lệ chuyển đổi và Chi phí/Kết quả (CPR), đồng thời đề xuất tối ưu ngân sách.',
    argsSchema: {
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
    buildText: (args, context) => {
      const targetHint = args.data_mart_name
        ? `ưu tiên tìm Data Mart khớp với "${args.data_mart_name}"`
        : 'tự động tìm Data Mart báo cáo hiệu quả chiến dịch quảng cáo (ví dụ: "[Doctor Care] Báo cáo Hiệu quả Chiến dịch" hoặc bảng dữ liệu quảng cáo tương đương)';
      const timeHint = args.thoi_gian
        ? `trong khoảng thời gian "${args.thoi_gian}"`
        : 'trên toàn bộ dữ liệu hiện có';
      return [
        `Hãy thực hiện phân tích chuyên sâu hiệu quả chiến dịch quảng cáo cho dự án hiện tại (projectId: ${context.projectId}) ${timeHint}:`,
        `1. Gọi get_project_context và tìm Data Mart phù hợp (${targetHint}) bằng get_relevant_data_marts_by_prompt hoặc list_data_marts.`,
        `2. Gọi get_data_mart_details_by_id để lấy chính xác tên các trường dữ liệu, sau đó dùng query_data_mart để truy vấn số liệu.`,
        `3. Lập bảng xếp hạng đầy đủ các chiến dịch theo: Chi tiêu (Spend), Lượt hiển thị (Impressions), Tiếp cận (Reach), Tần suất (Frequency), Tổng Kết quả (Results), Tỷ lệ Kết quả (%), và Chi phí / Kết quả (CPR).`,
        `4. Đánh giá chi tiết: (a) Chiến dịch hiệu quả nhất (CPR tối ưu, nhiều kết quả), (b) Chiến dịch đang lãng phí ngân sách (chi tiêu cao nhưng không ra kết quả hoặc CPR quá đắt), và (c) Đề xuất hành động tối ưu & phân bổ lại ngân sách cụ thể.`,
      ].join('\n');
    },
  },
  {
    name: 'tao-bao-cao-google-sheets',
    title: '📈 Tạo Data Mart SQL & Xuất báo cáo ra Google Sheets',
    description:
      'Tạo hoặc chọn Data Mart, thiết lập Báo cáo kết nối với Google Sheets, chạy đồng bộ ngay lập tức và trả về link bảng tính.',
    argsSchema: {
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
    buildText: (args, context) => {
      const topic = args.chu_de_bao_cao || 'Báo cáo Hiệu quả Chiến dịch';
      const sheetTarget = args.spreadsheet_id_hoac_url
        ? `vào Google Sheets "${args.spreadsheet_id_hoac_url}"`
        : 'sử dụng Google Sheets Destination đang được kết nối sẵn trong dự án';
      const tabHint = args.ten_sheet ? ` (tên tab/sheet: "${args.ten_sheet}")` : '';
      return [
        `Hãy giúp tôi tạo hoặc xuất báo cáo "${topic}" ra Google Sheets cho dự án hiện tại (projectId: ${context.projectId}) ${sheetTarget}${tabHint}:`,
        `1. Gọi get_project_context, list_data_marts và get_data_mart_reports để kiểm tra xem Data Mart và Báo cáo Google Sheets cho chủ đề "${topic}" đã tồn tại hay chưa.`,
        `2. Nếu chưa có Data Mart phù hợp, hãy kiểm tra kho dữ liệu bằng list_data_storages, tạo bản nháp SQL Data Mart với tên cột Tiếng Việt thân thiện (create_data_mart / update_data_mart), kiểm tra hợp lệ bằng validate_data_mart và hỏi ý kiến tôi trước khi publish_data_mart.`,
        `3. Nếu đã có Data Mart PUBLISHED, hãy tạo báo cáo mới bằng add_report (hoặc chạy lại báo cáo hiện có bằng run_report), theo dõi tiến trình bằng get_report_run_status cho đến khi should_poll=false, và gửi lại đường dẫn Google Sheets hoàn chỉnh.`,
      ].join('\n');
    },
  },
  {
    name: 'dat-lich-chay-bao-cao-tu-dong',
    title: '⏰ Đặt lịch tự động cập nhật báo cáo hàng ngày',
    description:
      'Thiết lập lịch chạy tự động (Schedule/Trigger) cho báo cáo Google Sheets theo múi giờ Việt Nam (Asia/Ho_Chi_Minh).',
    argsSchema: {
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
    buildText: (args, context) => {
      const target = args.ten_bao_cao_hoac_data_mart
        ? `cho báo cáo/Data Mart "${args.ten_bao_cao_hoac_data_mart}"`
        : 'cho báo cáo Google Sheets trong dự án';
      const time = args.gio_chay || '08:00';
      return [
        `Hãy thiết lập lịch tự động cập nhật báo cáo hàng ngày ${target} trong dự án hiện tại (projectId: ${context.projectId}):`,
        `1. Gọi list_data_marts và get_data_mart_reports để xác định chính xác report_id và kiểm tra các lịch chạy (schedules) hiện có.`,
        `2. Sử dụng create_report_run_schedule (hoặc update_report_run_schedule nếu đã có lịch) để đặt lịch chạy tự động hàng ngày vào lúc ${time} theo múi giờ Asia/Ho_Chi_Minh.`,
        `3. Xác nhận lại chi tiết cấu hình lịch chạy (report_id, schedule_id, tần suất, múi giờ) sau khi hoàn tất.`,
      ].join('\n');
    },
  },
  {
    name: 'kiem-tra-suc-khoe-du-lieu',
    title: '🔍 Kiểm tra tổng quan & sức khỏe dữ liệu dự án',
    description:
      'Kiểm tra toàn bộ Data Marts, kho dữ liệu BigQuery, kết nối Connector, báo cáo Google Sheets và trạng thái các lần chạy gần nhất.',
    argsSchema: {
      chi_tiet: z
        .string()
        .optional()
        .describe('Phạm vi kiểm tra (ví dụ: tat-ca, bao-cao, connector)'),
    },
    buildText: (args, context) => {
      const scopeHint = args.chi_tiet ? ` (trọng tâm: ${args.chi_tiet})` : '';
      return [
        `Hãy kiểm tra tổng quan và đánh giá sức khỏe dữ liệu cho dự án hiện tại (projectId: ${context.projectId})${scopeHint}:`,
        `1. Gọi get_project_context, summarize_data_catalog, list_data_marts và list_data_storages.`,
        `2. Với các Data Mart hiện có, gọi get_data_mart_setup_status và get_data_mart_reports để kiểm tra trạng thái xuất bản (PUBLISHED/DRAFT), lần chạy gần nhất và các báo cáo Google Sheets đi kèm.`,
        `3. Tổng hợp báo cáo sức khỏe dữ liệu rõ ràng gồm: (a) Kho dữ liệu BigQuery & trạng thái kết nối, (b) Danh sách Data Marts & số trường dữ liệu, (c) Danh sách Báo cáo Google Sheets & lịch chạy tự động, (d) Các lỗi hoặc cảnh báo cần chú ý.`,
      ].join('\n');
    },
  },
  {
    name: 'tao-data-mart-tu-connector',
    title: '🔌 Tạo Data Mart mới từ Connector (Facebook Ads, Google Ads, TikTok...)',
    description:
      'Khởi tạo bản nháp Data Mart thu thập dữ liệu từ các nền tảng quảng cáo/kinh doanh (Facebook Ads, Google Ads, GA4, Shopee, TikTok Ads...).',
    argsSchema: {
      nen_tang: z
        .string()
        .optional()
        .describe(
          'Tên nền tảng cần kết nối (ví dụ: Facebook Ads, Google Ads, Google Analytics 4, TikTok Ads)'
        ),
      ten_data_mart: z
        .string()
        .optional()
        .describe('Tên dự kiến cho Data Mart mới (tùy chọn)'),
    },
    buildText: (args, context) => {
      const platform = args.nen_tang || 'nền tảng quảng cáo/kinh doanh';
      const titleHint = args.ten_data_mart
        ? ` với tên "${args.ten_data_mart}"`
        : '';
      return [
        `Hãy hướng dẫn và khởi tạo bản nháp Data Mart thu thập dữ liệu từ Connector "${platform}"${titleHint} trong dự án hiện tại (projectId: ${context.projectId}):`,
        `1. Gọi get_project_context, list_data_storages và list_connectors để tìm Connector tương ứng với "${platform}".`,
        `2. Gọi get_connector_specification và get_connector_fields để lấy danh sách node và các trường dữ liệu chuẩn xác.`,
        `3. Hỏi tôi xác nhận bảng đích BigQuery (fully_qualified_name) nếu cần, sau đó khởi tạo DRAFT bằng create_connector / configure_connector và gửi đường dẫn cấu hình xác thực an toàn trên giao diện Web.`,
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
    private readonly instrumentation: McpCallInstrumentation
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
        // extra.signal fires on client disconnect/cancel — thread it so an abandoned query stops
        // waiting and is recorded CANCELLED (not billed) instead of running to completion.
        return tool.handler(input, mcpContext, extra?.signal);
      });

      sdkToolRegistrar.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: this.toStandardSchema(tool.zodSchema, true),
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
