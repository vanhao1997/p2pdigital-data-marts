import { z } from 'zod';
import {
  DEFAULT_HEADERS_TIMEOUT_MS,
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  DEFAULT_SERVER_TIMEOUT_MS,
} from './constants';

/**
 * Configuration schema for environment variables validation.
 * Validates and transforms specified environment variables while
 * passing through all other fields as-is for backwards compatibility.
 */
const configSchema = z
  .object({
    SCHEDULER_EXECUTION_ENABLED: z
      .string()
      .trim()
      .toLowerCase()
      .default('true')
      .transform(val => val !== 'false'),

    SCHEDULER_TIMEZONE: z.string().trim().default('UTC'),

    SERVER_TIMEOUT_MS: z.coerce.number().default(DEFAULT_SERVER_TIMEOUT_MS),
    KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().default(DEFAULT_KEEP_ALIVE_TIMEOUT_MS),
    HEADERS_TIMEOUT_MS: z.coerce.number().default(DEFAULT_HEADERS_TIMEOUT_MS),

    // Query parameters can contain credentials and PII. This opt-in is only
    // honored by the data-source factory when NODE_ENV=development.
    TYPEORM_LOG_QUERY_PARAMETERS: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(['true', 'false']))
      .default('false'),
    API_KEY_EXCHANGE_HMAC_SECRET: z.string().default(''),

    MAX_CONNECTOR_RUNS_PER_PROJECT: z.coerce.number().int().min(1).max(1000).default(3),
    MAX_REPORT_RUNS_PER_PROJECT: z.coerce.number().int().min(1).max(1000).default(1000),

    MCP_CLIENT_METADATA_DOCUMENT_ENABLED: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(['true', 'false']))
      .default('true'),
    MCP_DYNAMIC_CLIENT_REGISTRATION_ENABLED: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(['true', 'false']))
      .default('false'),
    MCP_CLIENT_METADATA_ALLOWED_ORIGINS: z.string().trim().default(''),
    MCP_CLIENT_METADATA_CACHE_TTL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(86_400_000)
      .default(300_000),
    MCP_CLIENT_METADATA_CACHE_MAX_TTL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(86_400_000)
      .default(3_600_000),
    MCP_CLIENT_METADATA_CACHE_MAX_ENTRIES: z.coerce.number().int().min(1).max(10_000).default(256),
    MCP_CLIENT_METADATA_FETCH_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(5_000),

    ADMICRO_EXTRACTOR_ENABLED: z
      .string()
      .trim()
      .toLowerCase()
      .default('false')
      .transform(value => value === 'true'),
    ADMICRO_EXTRACTOR_URL: z
      .string()
      .trim()
      .default('')
      .refine(value => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
        } catch {
          return false;
        }
      }, 'ADMICRO_EXTRACTOR_URL must be an HTTP(S) URL without embedded credentials'),
    ADMICRO_EXTRACTOR_SHARED_SECRET: z.string().default(''),
    ADMICRO_EXTRACTOR_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(2),

    // Plugin host. GITHUB_* stay unvalidated pass-through strings: they are optional and
    // mode-dependent, and PluginHostConfigService already treats a blank value as absent.
    PLUGIN_HOST_SYNC_MIN_INTERVAL_SEC: z.coerce.number().int().min(0).max(86_400).optional(),
    PLUGIN_HOST_REMOTE_PROBE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(8_000),
  })
  .passthrough()
  .superRefine((config, ctx) => {
    if (!config.ADMICRO_EXTRACTOR_ENABLED) return;
    if (!config.ADMICRO_EXTRACTOR_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMICRO_EXTRACTOR_URL'],
        message: 'ADMICRO_EXTRACTOR_URL is required when Admicro extractor is enabled',
      });
    }
    if (!config.ADMICRO_EXTRACTOR_SHARED_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMICRO_EXTRACTOR_SHARED_SECRET'],
        message: 'ADMICRO_EXTRACTOR_SHARED_SECRET is required when Admicro extractor is enabled',
      });
    }
  }); // Pass through all other fields as-is

/**
 * Inferred configuration type from the validation schema.
 *
 * This type includes all validated fields with their transformed types
 * plus any additional fields that are passed through unchanged.
 */
export type Config = z.infer<typeof configSchema>;

/**
 * Validates the provided configuration object against the schema.
 *
 * Performs validation and transformation of environment variables according to
 * the defined schema. Unknown fields are passed through unchanged.
 *
 * @param config - Raw configuration object (typically process.env)
 * @returns Validated and transformed configuration object
 * @throws {Error} When validation fails with detailed error message
 *
 * @example
 * ```typescript
 * const config = validateConfig(process.env);
 * console.log(config.SCHEDULER_EXECUTION_ENABLED); // boolean: true or false
 * console.log(config.SCHEDULER_TIMEZONE); // string: 'UTC' or provided value
 * ```
 */
export function validateConfig(config: Record<string, unknown>): Config {
  const result = configSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Configuration validation failed: ${result.error.message}`);
  }

  return result.data;
}
