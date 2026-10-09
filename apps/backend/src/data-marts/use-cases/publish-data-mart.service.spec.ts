jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
}));

import { BusinessViolationException } from '../../common/exceptions/business-violation.exception';
import { PublishDataMartService } from './publish-data-mart.service';
import { PublishDataMartCommand } from '../dto/domain/publish-data-mart.command';
import { DataMartDefinitionType } from '../enums/data-mart-definition-type.enum';
import { DataMartStatus } from '../enums/data-mart-status.enum';
import { RunType } from '../../common/scheduler/shared/types';

describe('PublishDataMartService', () => {
  const createService = (
    options: {
      isValid?: boolean;
      definitionType?: DataMartDefinitionType;
      definition?: Record<string, unknown>;
    } = { isValid: true }
  ) => {
    const dataMart = {
      id: 'dm-1',
      projectId: 'proj-1',
      status: DataMartStatus.DRAFT,
      definitionType: options.definitionType ?? DataMartDefinitionType.TABLE,
      definition: options.definition ?? { tableName: 'my_table' },
      createdById: 'user-1',
    };

    const dataMartService = {
      getByIdAndProjectId: jest.fn().mockResolvedValue(dataMart),
      save: jest.fn().mockResolvedValue(dataMart),
    };

    const definitionValidatorFacade = {
      checkIsValid: jest.fn().mockImplementation(() => {
        if (options.isValid === false) {
          throw new BusinessViolationException('Storage validation failed');
        }
        return Promise.resolve();
      }),
    };

    const mapper = {
      toDomainDto: jest.fn().mockReturnValue({ id: 'dm-1', status: DataMartStatus.PUBLISHED }),
    };

    const eventDispatcher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const accessDecisionService = {
      canAccess: jest.fn().mockResolvedValue(true),
    };

    const connectorExecutionService = {
      run: jest.fn().mockResolvedValue(undefined),
    };

    const advancedSearchIndexSync = {
      scheduleReindex: jest.fn().mockResolvedValue(undefined),
    };
    const service = new (PublishDataMartService as any)(
      dataMartService as any,
      definitionValidatorFacade as any,
      mapper as any,
      eventDispatcher as any,
      accessDecisionService as any,
      connectorExecutionService as any,
      advancedSearchIndexSync
    );

    return {
      service: service as PublishDataMartService,
      dataMartService,
      definitionValidatorFacade,
      dataMart,
      connectorExecutionService,
      advancedSearchIndexSync,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should publish successfully when storage validation succeeds', async () => {
    const { service, dataMartService, definitionValidatorFacade, dataMart } = createService({
      isValid: true,
    });
    const command = new PublishDataMartCommand('dm-1', 'proj-1', 'user-1', ['editor'], 'user-1');

    const result = await service.run(command);

    expect(definitionValidatorFacade.checkIsValid).toHaveBeenCalledWith(dataMart);
    expect(dataMart.status).toBe(DataMartStatus.PUBLISHED);
    expect(dataMartService.save).toHaveBeenCalledWith(dataMart);
    expect(result.status).toBe(DataMartStatus.PUBLISHED);
  });

  it('schedules search reindex after successful publish', async () => {
    const { service, advancedSearchIndexSync } = createService({ isValid: true });
    const command = new PublishDataMartCommand('dm-1', 'proj-1', 'user-1', ['editor'], 'user-1');

    await service.run(command);

    expect(advancedSearchIndexSync.scheduleReindex).toHaveBeenCalledWith(
      'DATA_MART',
      'dm-1',
      'proj-1'
    );
  });

  it('does not start connector execution for non-connector Data Marts', async () => {
    const { service, connectorExecutionService } = createService({ isValid: true });
    const command = new PublishDataMartCommand('dm-1', 'proj-1', 'user-1', ['editor'], 'user-1');

    await service.run(command);

    expect(connectorExecutionService.run).not.toHaveBeenCalled();
  });

  it('starts exactly one incremental connector run after connector publish using the publish actor', async () => {
    const { service, dataMart, connectorExecutionService } = createService({
      isValid: true,
      definitionType: DataMartDefinitionType.CONNECTOR,
      definition: {
        connector: {
          source: { name: 'GoogleAds', node: 'campaigns', fields: ['id'], configuration: [] },
          storage: { fullyQualifiedName: 'warehouse.dataset.table' },
        },
      },
    });
    const command = new PublishDataMartCommand(
      'dm-1',
      'proj-1',
      'user-1',
      ['editor'],
      'publish-actor'
    );

    await service.run(command);

    expect(connectorExecutionService.run).toHaveBeenCalledTimes(1);
    expect(connectorExecutionService.run).toHaveBeenCalledWith(
      dataMart,
      'publish-actor',
      RunType.manual,
      { runType: 'INCREMENTAL' }
    );
  });

  it('should reject publish when storage validation fails', async () => {
    const { service, dataMartService, connectorExecutionService, advancedSearchIndexSync } =
      createService({
        isValid: false,
      });
    const command = new PublishDataMartCommand('dm-1', 'proj-1', 'user-1', ['editor'], 'user-1');

    await expect(service.run(command)).rejects.toThrow(BusinessViolationException);
    expect(dataMartService.save).not.toHaveBeenCalled();
    expect(connectorExecutionService.run).not.toHaveBeenCalled();
    expect(advancedSearchIndexSync.scheduleReindex).not.toHaveBeenCalled();
  });
});
