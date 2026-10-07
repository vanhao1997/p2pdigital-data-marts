import { ConsumptionContext } from '../../ai-insights/data-mart-insights.types';
import { createHash } from 'node:crypto';
import { GoogleSheetsConfig } from '../../data-destination-types/google-sheets/schemas/google-sheets-config.schema';
import { ProjectBalanceDto } from '../../dto/domain/project-balance.dto';
import { DataMart } from '../../entities/data-mart.entity';
import { Report } from '../../entities/report.entity';
import { ProjectPlanType } from '../../enums/project-plan-type.enum';

export enum RunKind {
  CONNECTOR_RUN = 'CONNECTOR_RUN',
  DATA_QUALITY_RUN = 'DATA_QUALITY_RUN',
  AI_PROCESS_RUN = 'AI_PROCESS_RUN',
  SHEETS_REPORT_RUN = 'SHEETS_REPORT_RUN',
  LOOKER_REPORT_RUN = 'LOOKER_REPORT_RUN',
  EMAIL_BASED_REPORT_RUN = 'EMAIL_BASED_REPORT_RUN',
  EXCEL_REPORT_RUN = 'EXCEL_REPORT_RUN',
  HTTP_DATA_RUN = 'HTTP_DATA_RUN',
  MCP_QUERY_RUN = 'MCP_QUERY_RUN',
}

export const REPORT_RUN_KINDS: readonly RunKind[] = [
  RunKind.SHEETS_REPORT_RUN,
  RunKind.LOOKER_REPORT_RUN,
  RunKind.EMAIL_BASED_REPORT_RUN,
  RunKind.EXCEL_REPORT_RUN,
  RunKind.HTTP_DATA_RUN,
  RunKind.MCP_QUERY_RUN,
];

export function isReportRun(kind: RunKind): boolean {
  return REPORT_RUN_KINDS.includes(kind);
}

/**
 * Produces the idempotency key shared by self-managed forwarding and Cloud
 * Pub/Sub. Runtime timestamps are intentionally excluded so a retry of the
 * same logical run is deduplicated even when it is rebuilt later.
 */
export function buildConsumptionDedupeKey(kind: RunKind, payload: Record<string, unknown>): string {
  const identity = {
    kind,
    projectId: payload.projectId ?? null,
    dataMartId: payload.dataMartId ?? null,
    dataStorageId: payload.dataStorageId ?? null,
    dataDestinationId: payload.dataDestinationId ?? null,
    reportId: payload.reportId ?? null,
    reportRunId: payload.reportRunId ?? null,
    runId: payload.runId ?? null,
    processRunId: payload.processRunId ?? null,
    contextId: payload.contextId ?? null,
    selfManagedProjectId: payload.selfManagedProjectId ?? null,
    selfManagedLicenseKeyId: payload.selfManagedLicenseKeyId ?? null,
  };
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

export interface SheetsReportDetails {
  googleSheetsDocumentTitle: string;
  googleSheetsListTitle: string;
}

/**
 * Balance checks and consumption reporting for a project. Also the DI token:
 * the binding-specific implementation is chosen by projectBillingProvider.
 */
export abstract class ProjectBillingService {
  abstract verifyCanPerformOperations(projectId: string, runKind: RunKind): Promise<void>;

  abstract registerConnectorRunConsumption(
    dataMart: DataMart,
    connectorRunId: string
  ): Promise<void>;

  abstract registerDataQualityRunConsumption(
    dataMart: DataMart,
    dataMartRunId: string
  ): Promise<void>;

  abstract registerAiProcessRunConsumption(
    tokensProcessed: number,
    context: ConsumptionContext
  ): Promise<void>;

  abstract registerSheetsReportRunConsumption(
    report: Report,
    reportRunId: string,
    sheetsDetails: SheetsReportDetails
  ): Promise<void>;

  abstract registerLookerReportRunConsumption(report: Report, reportRunId: string): Promise<void>;

  abstract registerEmailBasedReportRunConsumption(
    report: Report,
    reportRunId: string
  ): Promise<void>;

  /**
   * An Excel report is pulled by the workbook, so its run arrives over the same endpoint as a
   * plain HTTP read. It is charged as a report run all the same: the unit describes what the
   * customer did, not which transport carried it, and the HTTP Data payload names neither the
   * report nor the destination it was read for.
   *
   * Takes the DataMartRun id rather than synthesising one, so a consumption record and the run
   * it was charged for can be matched afterwards.
   */
  abstract registerExcelReportRunConsumption(report: Report, runId: string): Promise<void>;

  abstract registerHttpDataRunConsumption(dataMart: DataMart, runId: string): Promise<void>;

  abstract registerMcpQueryRunConsumption(dataMart: DataMart, runId: string): Promise<void>;

  protected baseDataMartConsumptionPayload(dataMart: DataMart) {
    return {
      projectId: dataMart.projectId,
      dataMartId: dataMart.id,
      dataStorageId: dataMart.storage.id,
      dataStorageType: dataMart.storage.type,
      runTime: new Date().toISOString(),
    };
  }

  protected baseReportConsumptionPayload(report: Report, reportRunId: string) {
    return {
      ...this.baseDataMartConsumptionPayload(report.dataMart),
      dataDestinationId: report.dataDestination.id,
      dataDestinationType: report.dataDestination.type,
      reportId: report.id,
      reportRunId,
    };
  }

  protected sheetsReportConsumptionPayload(
    report: Report,
    reportRunId: string,
    _sheetsDetails: SheetsReportDetails
  ) {
    const reportConfig = report.destinationConfig as GoogleSheetsConfig;
    return {
      ...this.baseReportConsumptionPayload(report, reportRunId),
      googleSheetsDocumentId: reportConfig.spreadsheetId,
      googleSheetsListId: reportConfig.sheetId,
    };
  }

  protected excelReportConsumptionPayload(report: Report, runId: string) {
    return this.baseReportConsumptionPayload(report, runId);
  }

  protected httpDataConsumptionPayload(dataMart: DataMart, runId: string) {
    return {
      ...this.baseDataMartConsumptionPayload(dataMart),
      reportRunId: runId,
    };
  }

  protected mcpQueryConsumptionPayload(dataMart: DataMart, runId: string) {
    return {
      ...this.baseDataMartConsumptionPayload(dataMart),
      runId,
    };
  }

  protected zeroBalance(): ProjectBalanceDto {
    return {
      subscriptionPlanType: ProjectPlanType.FREE,
      availableCredits: 0,
      consumedCredits: 0,
      creditUsagePercentage: 0,
    };
  }
}
