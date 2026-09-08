/** Threshold for "recently created" user (1 day in ms). */
export const USER_AGE_THRESHOLD_MS = 1 * 24 * 60 * 60 * 1000;

/** Question identifiers for onboarding questionnaire. */
export const ONBOARDING_QUESTION = {
  USE_CASE: 'use_case',
  ORG_DOMAIN: 'org_domain',
  PRIMARY_ROLE: 'primary_role',
  PRIMARY_STORAGE: 'primary_storage',
} as const;

export type OnboardingQuestionId = (typeof ONBOARDING_QUESTION)[keyof typeof ONBOARDING_QUESTION];

/** Answer values for the onboarding use-case question (multi-select). */
export const USE_CASE_ANSWER = {
  SYNC_DWH_SHEETS: 'sync_dwh_sheets',
  SYNC_DWH_LOOKER: 'sync_dwh_looker',
  AI_INSIGHTS: 'ai_insights',
  IMPORT_EXTERNAL_DWH: 'import_external_dwh',
  IMPORT_EXTERNAL_SHEETS: 'import_external_sheets',
  OTHER: 'other',
} as const;

/** Answer values for "What is your primary role?" (single-select). */
export const PRIMARY_ROLE_ANSWER = {
  DATA_ANALYST_ENGINEER: 'data_analyst_engineer',
  DIGITAL_MARKETER: 'digital_marketer',
  HEAD_OF_ANALYTICS: 'head_of_analytics',
  C_LEVEL: 'c_level',
  OTHER: 'other',
} as const;

/** Answer values for the primary storage question (single-select). */
export const PRIMARY_STORAGE_ANSWER = {
  GBQ: 'gbq',
  AWS_ATHENA: 'aws_athena',
  AWS_REDSHIFT: 'aws_redshift',
  SNOWFLAKE: 'snowflake',
  DATABRICKS: 'databricks',
  AZURE_SYNAPSE: 'azure_synapse',
  OWOX_CLOUD_EU: 'owox_cloud_eu',
  OWOX_CLOUD_US: 'owox_cloud_us',
  DONT_KNOW: 'dont_know',
  OTHER: 'other',
} as const;

/** Validation sets for server-side answer checking. */
export const VALID_USE_CASE_VALUES = new Set(Object.values(USE_CASE_ANSWER));
export const VALID_PRIMARY_ROLE_VALUES = new Set(Object.values(PRIMARY_ROLE_ANSWER));
export const VALID_PRIMARY_STORAGE_VALUES = new Set(Object.values(PRIMARY_STORAGE_ANSWER));

/** Option definitions with labels for rendering in templates. */
export interface OnboardingOption {
  value: string;
  label: string;
}

export const USE_CASE_OPTIONS: OnboardingOption[] = [
  {
    value: USE_CASE_ANSWER.SYNC_DWH_SHEETS,
    label: 'Đồng bộ dữ liệu trực tiếp từ kho của tổ chức vào Sheets',
  },
  {
    value: USE_CASE_ANSWER.SYNC_DWH_LOOKER,
    label: 'Đồng bộ dữ liệu trực tiếp từ kho của tổ chức đến Data Studio',
  },
  {
    value: USE_CASE_ANSWER.AI_INSIGHTS,
    label: 'Gửi thông tin chuyên sâu AI đến Slack / Teams / Email',
  },
  {
    value: USE_CASE_ANSWER.IMPORT_EXTERNAL_DWH,
    label: 'Nhập dữ liệu bên ngoài vào kho dữ liệu của tổ chức',
  },
  {
    value: USE_CASE_ANSWER.IMPORT_EXTERNAL_SHEETS,
    label: 'Nhập dữ liệu bên ngoài trực tiếp vào Sheets',
  },
  { value: USE_CASE_ANSWER.OTHER, label: 'Mục đích khác' },
];

export const PRIMARY_ROLE_OPTIONS: OnboardingOption[] = [
  {
    value: PRIMARY_ROLE_ANSWER.DATA_ANALYST_ENGINEER,
    label: 'Chuyên viên phân tích / kỹ sư dữ liệu',
  },
  { value: PRIMARY_ROLE_ANSWER.DIGITAL_MARKETER, label: 'Chuyên viên tiếp thị số' },
  { value: PRIMARY_ROLE_ANSWER.HEAD_OF_ANALYTICS, label: 'Trưởng bộ phận phân tích / dữ liệu' },
  { value: PRIMARY_ROLE_ANSWER.C_LEVEL, label: 'Cấp điều hành' },
  { value: PRIMARY_ROLE_ANSWER.OTHER, label: 'Khác' },
];

export const PRIMARY_STORAGE_OPTIONS: OnboardingOption[] = [
  { value: PRIMARY_STORAGE_ANSWER.GBQ, label: 'Google BigQuery' },
  { value: PRIMARY_STORAGE_ANSWER.AWS_ATHENA, label: 'AWS Athena' },
  { value: PRIMARY_STORAGE_ANSWER.AWS_REDSHIFT, label: 'AWS Redshift' },
  { value: PRIMARY_STORAGE_ANSWER.SNOWFLAKE, label: 'Snowflake' },
  { value: PRIMARY_STORAGE_ANSWER.DATABRICKS, label: 'Databricks' },
  { value: PRIMARY_STORAGE_ANSWER.AZURE_SYNAPSE, label: 'Azure Synapse' },
  { value: PRIMARY_STORAGE_ANSWER.OWOX_CLOUD_EU, label: 'P2PDigital Cloud (EU)' },
  { value: PRIMARY_STORAGE_ANSWER.OWOX_CLOUD_US, label: 'P2PDigital Cloud (US)' },
  { value: PRIMARY_STORAGE_ANSWER.DONT_KNOW, label: 'Chưa có kho dữ liệu' },
  { value: PRIMARY_STORAGE_ANSWER.OTHER, label: 'Kho dữ liệu khác' },
];
