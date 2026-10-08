import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { SchedulerFacade } from '../../common/scheduler/shared/scheduler.facade';
import { TriggerStatus } from '../../common/scheduler/shared/entities/trigger-status';
import { RunType } from '../../common/scheduler/shared/types';
import { ConnectorRunTrigger } from '../entities/connector-run-trigger.entity';
import { ConnectorState } from '../entities/connector-state.entity';
import { Context } from '../entities/context.entity';
import { DataMart } from '../entities/data-mart.entity';
import { DataMartBusinessOwner } from '../entities/data-mart-business-owner.entity';
import { DataMartContext } from '../entities/data-mart-context.entity';
import { DataMartRun } from '../entities/data-mart-run.entity';
import { DataMartTechnicalOwner } from '../entities/data-mart-technical-owner.entity';
import { DataStorage } from '../entities/data-storage.entity';
import { DataStorageCredential } from '../entities/data-storage-credential.entity';
import { ReportRunTrigger } from '../entities/report-run-trigger.entity';
import { StorageContext } from '../entities/storage-context.entity';
import { StorageOwner } from '../entities/storage-owner.entity';
import { DataStorageType } from '../data-storage-types/enums/data-storage-type.enum';
import { DataMartRunStatus } from '../enums/data-mart-run-status.enum';
import { DataMartRunType } from '../enums/data-mart-run-type.enum';
import { ConnectorExecutionService } from './connector/connector-execution.service';
import { ConnectorRunTriggerHandlerService } from './connector/connector-run-trigger-handler.service';
import { DataMartRunService } from './data-mart-run.service';
import { DataMartService } from './data-mart.service';
import { ReportRunTriggerHandlerService } from './report-run-trigger-handler.service';
import { RunReportService } from '../use-cases/run-report.service';

const TEST_ENTITIES = [
  DataMart,
  DataMartRun,
  DataStorage,
  DataStorageCredential,
  DataMartContext,
  DataMartBusinessOwner,
  DataMartTechnicalOwner,
  ConnectorState,
  Context,
  StorageOwner,
  StorageContext,
];

describe('run trigger concurrency claims with SQLite transactions', () => {
  let dataSource: DataSource;
  let dataMartRepository: Repository<DataMart>;
  let dataMartRunRepository: Repository<DataMartRun>;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: TEST_ENTITIES,
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();
    dataMartRepository = dataSource.getRepository(DataMart);
    dataMartRunRepository = dataSource.getRepository(DataMartRun);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('admits the first connector run at limit 1 and rolls back the next claim', async () => {
    const dataMart = await seedDataMart('connector-dm');
    const first = await seedRun(dataMart, DataMartRunType.CONNECTOR, 'connector-run-1');
    const second = await seedRun(dataMart, DataMartRunType.CONNECTOR, 'connector-run-2');
    const service = createConnectorService(1);
    const claimRunSlot = connectorClaim(service);

    await claimRunSlot(connectorTrigger(first.id, dataMart), dataMart.projectId);

    await expect(
      claimRunSlot(connectorTrigger(second.id, dataMart), dataMart.projectId)
    ).rejects.toThrow('reached the limit of 1');

    await expect(dataMartRunRepository.findOneByOrFail({ id: first.id })).resolves.toMatchObject({
      status: DataMartRunStatus.RUNNING,
    });
    await expect(dataMartRunRepository.findOneByOrFail({ id: second.id })).resolves.toMatchObject({
      status: DataMartRunStatus.PENDING,
    });
  });

  it('admits three connector runs at limit 3 and leaves the fourth pending', async () => {
    const dataMart = await seedDataMart('connector-dm-limit-3');
    const runs: DataMartRun[] = [];
    for (let index = 0; index < 4; index += 1) {
      runs.push(
        await seedRun(dataMart, DataMartRunType.CONNECTOR, `connector-run-limit-3-${index}`)
      );
    }
    const service = createConnectorService(3);
    const claimRunSlot = connectorClaim(service);

    for (const run of runs.slice(0, 3)) {
      await claimRunSlot(connectorTrigger(run.id, dataMart), dataMart.projectId);
    }

    await expect(
      claimRunSlot(connectorTrigger(runs[3].id, dataMart), dataMart.projectId)
    ).rejects.toThrow('reached the limit of 3');

    const states = await dataMartRunRepository.find({
      where: runs.map(run => ({ id: run.id })),
    });
    expect(states.filter(run => run.status === DataMartRunStatus.RUNNING)).toHaveLength(3);
    expect(states.filter(run => run.status === DataMartRunStatus.PENDING)).toHaveLength(1);
  });

  it('admits the first report run at limit 1 and rolls back the next claim', async () => {
    const dataMart = await seedDataMart('report-dm-limit-1');
    const first = await seedRun(dataMart, DataMartRunType.EMAIL, 'report-run-1');
    const second = await seedRun(dataMart, DataMartRunType.EMAIL, 'report-run-2');
    const service = createReportService(1);
    const claimRunSlot = reportClaim(service);

    await claimRunSlot(first.id, dataMart.projectId);

    await expect(claimRunSlot(second.id, dataMart.projectId)).rejects.toThrow(
      'reached the limit of 1'
    );

    await expect(dataMartRunRepository.findOneByOrFail({ id: first.id })).resolves.toMatchObject({
      status: DataMartRunStatus.RUNNING,
    });
    await expect(dataMartRunRepository.findOneByOrFail({ id: second.id })).resolves.toMatchObject({
      status: DataMartRunStatus.PENDING,
    });
  });

  it('admits three report runs at limit 3 and leaves the fourth pending', async () => {
    const dataMart = await seedDataMart('report-dm-limit-3');
    const runs: DataMartRun[] = [];
    for (let index = 0; index < 4; index += 1) {
      runs.push(await seedRun(dataMart, DataMartRunType.EMAIL, `report-run-limit-3-${index}`));
    }
    const service = createReportService(3);
    const claimRunSlot = reportClaim(service);

    for (const run of runs.slice(0, 3)) {
      await claimRunSlot(run.id, dataMart.projectId);
    }

    await expect(claimRunSlot(runs[3].id, dataMart.projectId)).rejects.toThrow(
      'reached the limit of 3'
    );

    const states = await dataMartRunRepository.find({
      where: runs.map(run => ({ id: run.id })),
    });
    expect(states.filter(run => run.status === DataMartRunStatus.RUNNING)).toHaveLength(3);
    expect(states.filter(run => run.status === DataMartRunStatus.PENDING)).toHaveLength(1);
  });

  async function seedDataMart(id: string): Promise<DataMart> {
    const storage = dataSource.getRepository(DataStorage).create({
      id: `${id}-storage`,
      type: DataStorageType.GOOGLE_BIGQUERY,
      projectId: 'project-1',
      title: 'Test storage',
      availableForUse: true,
      availableForMaintenance: false,
      createdById: 'user-1',
    });
    const savedStorage = await dataSource.getRepository(DataStorage).save(storage);

    return dataMartRepository.save(
      dataMartRepository.create({
        id,
        title: 'Test data mart',
        projectId: 'project-1',
        createdById: 'user-1',
        storage: savedStorage,
        availableForReporting: true,
        availableForMaintenance: true,
      })
    );
  }

  async function seedRun(
    dataMart: DataMart,
    type: DataMartRunType,
    id: string
  ): Promise<DataMartRun> {
    return dataMartRunRepository.save(
      dataMartRunRepository.create({
        id,
        dataMart,
        dataMartId: dataMart.id,
        type,
        definitionRun: null,
        status: DataMartRunStatus.PENDING,
        runType: RunType.manual,
        createdById: 'user-1',
      })
    );
  }

  function createConnectorService(maxRuns: number): ConnectorRunTriggerHandlerService {
    const triggerRepository = {
      save: jest.fn(),
      update: jest.fn(),
    } as unknown as Repository<ConnectorRunTrigger>;
    const schedulerFacade = {
      registerTriggerHandler: jest.fn(),
    } as unknown as SchedulerFacade;
    const connectorExecutionService = {
      executeExistingRun: jest.fn(),
    } as unknown as ConnectorExecutionService;
    const dataMartService = {} as DataMartService;
    const dataMartRunService = {} as DataMartRunService;
    const configService = {
      get: jest.fn().mockReturnValue(maxRuns),
    } as unknown as ConfigService;

    return new ConnectorRunTriggerHandlerService(
      triggerRepository,
      dataMartRunRepository,
      schedulerFacade,
      connectorExecutionService,
      dataMartService,
      dataMartRunService,
      configService,
      dataSource
    );
  }

  function createReportService(maxRuns: number): ReportRunTriggerHandlerService {
    const triggerRepository = {
      save: jest.fn(),
      update: jest.fn(),
    } as unknown as Repository<ReportRunTrigger>;
    const schedulerFacade = {
      registerTriggerHandler: jest.fn(),
    } as unknown as SchedulerFacade;
    const runReportService = {} as RunReportService;
    const dataMartRunService = {} as DataMartRunService;
    const configService = {
      get: jest.fn().mockReturnValue(maxRuns),
    } as unknown as ConfigService;

    return new ReportRunTriggerHandlerService(
      triggerRepository,
      dataMartRunRepository,
      schedulerFacade,
      runReportService,
      dataMartRunService,
      configService,
      dataSource
    );
  }

  function connectorTrigger(dataMartRunId: string, dataMart: DataMart): ConnectorRunTrigger {
    return {
      id: `trigger-${dataMartRunId}`,
      dataMartId: dataMart.id,
      projectId: dataMart.projectId,
      dataMartRunId,
      status: TriggerStatus.PROCESSING,
      isActive: true,
    } as ConnectorRunTrigger;
  }

  function connectorClaim(service: ConnectorRunTriggerHandlerService) {
    return (
      service as unknown as {
        claimRunSlotAtomically: (
          trigger: ConnectorRunTrigger,
          projectId: string
        ) => Promise<DataMartRun>;
      }
    ).claimRunSlotAtomically.bind(service);
  }

  function reportClaim(service: ReportRunTriggerHandlerService) {
    return (
      service as unknown as {
        claimRunSlotAtomically: (dataMartRunId: string, projectId: string) => Promise<void>;
      }
    ).claimRunSlotAtomically.bind(service);
  }
});
