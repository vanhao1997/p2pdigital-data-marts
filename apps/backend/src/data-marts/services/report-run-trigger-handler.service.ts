import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SCHEDULER_FACADE, SchedulerFacade } from '../../common/scheduler/shared/scheduler.facade';
import { TriggerStatus } from '../../common/scheduler/shared/entities/trigger-status';
import { ConcurrencyLimitExceededException } from '../../common/exceptions/concurrency-limit-exceeded.exception';
import { ReportRunTrigger } from '../entities/report-run-trigger.entity';
import { DataMartRun } from '../entities/data-mart-run.entity';
import { DataMart } from '../entities/data-mart.entity';
import { DataMartRunStatus } from '../enums/data-mart-run-status.enum';
import { DataMartRunType } from '../enums/data-mart-run-type.enum';
import { DataMartRunService } from './data-mart-run.service';
import { RunReportService } from '../use-cases/run-report.service';
import { BaseRunTriggerHandlerService } from './base-run-trigger-handler.service';
import {
  durationBucket,
  recordOperationalMetric,
} from '../../common/observability/operational-metric';

const REPORT_RUN_TYPES = [
  DataMartRunType.GOOGLE_SHEETS_EXPORT,
  DataMartRunType.LOOKER_STUDIO,
  DataMartRunType.EMAIL,
  DataMartRunType.SLACK,
  DataMartRunType.MS_TEAMS,
  DataMartRunType.GOOGLE_CHAT,
];

@Injectable()
export class ReportRunTriggerHandlerService extends BaseRunTriggerHandlerService<ReportRunTrigger> {
  protected readonly logger = new Logger(ReportRunTriggerHandlerService.name);

  constructor(
    @InjectRepository(ReportRunTrigger)
    private readonly repository: Repository<ReportRunTrigger>,
    @InjectRepository(DataMartRun)
    dataMartRunRepository: Repository<DataMartRun>,
    @Inject(SCHEDULER_FACADE)
    schedulerFacade: SchedulerFacade,
    private readonly runReportService: RunReportService,
    dataMartRunService: DataMartRunService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource
  ) {
    super(schedulerFacade, dataMartRunService, dataMartRunRepository);
  }

  async handleTrigger(
    trigger: ReportRunTrigger,
    options?: { signal?: AbortSignal }
  ): Promise<void> {
    const executionStartedAt = Date.now();
    try {
      if (await this.cancelTriggerIfRunAlreadyCancelled(trigger)) {
        return;
      }

      await this.claimRunSlotAtomically(trigger.dataMartRunId, trigger.projectId);

      this.logger.log(
        `Executing report run for report ${trigger.reportId}, dataMartRunId ${trigger.dataMartRunId}`
      );

      await this.runReportService.executeExistingRun(
        trigger.dataMartRunId,
        trigger.projectId,
        trigger.createdById,
        options?.signal
      );
      recordOperationalMetric(
        this.logger,
        'report_delivery',
        options?.signal?.aborted ? 'cancelled' : 'success',
        { durationBucket: durationBucket(Date.now() - executionStartedAt) }
      );
      if (options?.signal?.aborted) {
        await this.markTriggerAsCancelled(
          trigger,
          `Cancelled run trigger ${trigger.id}: abort signal received for DataMartRun ${trigger.dataMartRunId}`
        );
      }
    } catch (error) {
      if (error instanceof ConcurrencyLimitExceededException) {
        recordOperationalMetric(this.logger, 'report_delivery', 'retry');
        this.logger.warn(
          `Report concurrency limit reached for project ${trigger.projectId}, trigger ${trigger.id} will retry`
        );
        trigger.status = TriggerStatus.IDLE;
        trigger.isActive = true;
        await this.repository.save(trigger);
        return;
      }

      const existingRun = await this.dataMartRunService.findById(trigger.dataMartRunId);
      if (existingRun?.status === DataMartRunStatus.RUNNING) {
        this.logger.warn(
          `DataMartRun ${trigger.dataMartRunId} is already RUNNING, skipping duplicate trigger ${trigger.id}`
        );
        return;
      }
      if (existingRun?.status === DataMartRunStatus.CANCELLED) {
        recordOperationalMetric(this.logger, 'report_delivery', 'cancelled', {
          durationBucket: durationBucket(Date.now() - executionStartedAt),
        });
        await this.markTriggerAsCancelled(
          trigger,
          `Skipping run trigger ${trigger.id}: DataMartRun ${trigger.dataMartRunId} is already CANCELLED`
        );
        return;
      }

      await this.failDataMartRunSafely(trigger.dataMartRunId, error);

      recordOperationalMetric(this.logger, 'report_delivery', 'failed', {
        durationBucket: durationBucket(Date.now() - executionStartedAt),
      });

      this.logger.error(
        `Error processing report run trigger ${trigger.id}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Claims a run slot in one transaction.
   *
   * The run is moved from PENDING to RUNNING before the count, so the claimed run is
   * included in the limit. MySQL/MariaDB use a pessimistic lock on every Data Mart in
   * the project before the claim. That gives concurrent workers a common row set to
   * serialize on under REPEATABLE READ without adding a semaphore table or migration.
   */
  private async claimRunSlotAtomically(dataMartRunId: string, projectId: string): Promise<void> {
    const maxRuns = this.configService.get<number>('MAX_REPORT_RUNS_PER_PROJECT', 1000);

    await this.dataSource.transaction(async manager => {
      await this.serializeProjectSlotClaims(manager, projectId);

      const claimResult = await manager.update(
        DataMartRun,
        { id: dataMartRunId, status: DataMartRunStatus.PENDING },
        { status: DataMartRunStatus.RUNNING }
      );

      if (!claimResult.affected) {
        throw new Error(`DataMartRun ${dataMartRunId} is not in PENDING status, cannot claim`);
      }

      const activeCount = await manager
        .createQueryBuilder(DataMartRun, 'run')
        .innerJoin(DataMart, 'dm', 'dm.id = run.dataMartId')
        .where('dm.projectId = :projectId', { projectId })
        .andWhere('run.status = :status', { status: DataMartRunStatus.RUNNING })
        .andWhere('run.type IN (:...types)', { types: REPORT_RUN_TYPES })
        .getCount();

      if (activeCount > maxRuns) {
        throw new ConcurrencyLimitExceededException(
          `Project ${projectId} has reached the limit of ${maxRuns} concurrent report runs`
        );
      }
    });
  }

  private async serializeProjectSlotClaims(
    manager: EntityManager,
    projectId: string
  ): Promise<void> {
    const databaseType = this.dataSource.options?.type;
    if (databaseType !== 'mysql' && databaseType !== 'mariadb') {
      return;
    }

    await manager
      .createQueryBuilder(DataMart, 'dm')
      .select('dm.id')
      .withDeleted()
      .where('dm.projectId = :projectId', { projectId })
      .setLock('pessimistic_write')
      .getRawMany();
  }

  getTriggerRepository(): Repository<ReportRunTrigger> {
    return this.repository;
  }

  processingCronExpression(): string {
    return '*/5 * * * * *';
  }

  stuckTriggerTimeoutSeconds(): number {
    return 60 * 60;
  }

  triggerTtlSeconds(): number {
    return 23 * 60 * 60;
  }

  protected getRunTypes(): string[] {
    return REPORT_RUN_TYPES;
  }

  protected getTriggerEntityClass(): new () => ReportRunTrigger {
    return ReportRunTrigger;
  }

  protected getTriggerRunIdField(): string {
    return 'dataMartRunId';
  }
}
