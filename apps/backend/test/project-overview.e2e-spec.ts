import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as supertest from 'supertest';
import { AUTH_HEADER, closeTestApp, createTestApp, StorageBuilder } from '@owox/test-utils';
import type { IdpProvider, Payload } from '@owox/idp-protocol';
import { IdpProjectionsFacade } from '../src/idp/facades/idp-projections.facade';
import { DataMart } from '../src/data-marts/entities/data-mart.entity';
import { DataMartRun } from '../src/data-marts/entities/data-mart-run.entity';
import { DataStorage } from '../src/data-marts/entities/data-storage.entity';
import { DataMartContext } from '../src/data-marts/entities/data-mart-context.entity';
import { DataMartTechnicalOwner } from '../src/data-marts/entities/data-mart-technical-owner.entity';
import { MemberRoleScope } from '../src/data-marts/entities/member-role-scope.entity';
import { MemberRoleContext } from '../src/data-marts/entities/member-role-context.entity';
import { Context } from '../src/data-marts/entities/context.entity';
import { DataMartDefinitionType } from '../src/data-marts/enums/data-mart-definition-type.enum';
import { DataMartStatus } from '../src/data-marts/enums/data-mart-status.enum';
import { DataMartRunStatus } from '../src/data-marts/enums/data-mart-run-status.enum';
import { DataMartRunType } from '../src/data-marts/enums/data-mart-run-type.enum';
import { RoleScope } from '../src/data-marts/enums/role-scope.enum';
import { RunType } from '../src/common/scheduler/shared/types';

describe('Project overview API (e2e)', () => {
  let app: INestApplication;
  let agent: supertest.Agent;
  let db: DataSource;
  let provider: IdpProvider;
  let membership: jest.SpyInstance;
  let tokenPayload: Payload;
  let storage: DataStorage;
  let visible: DataMart;
  let hidden: DataMart;
  let owner: DataMart;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    agent = testApp.agent;
    db = app.get(DataSource);
    provider = app.getHttpAdapter().getInstance().get('idp') as IdpProvider;
    jest.spyOn(provider, 'introspectToken').mockImplementation(async token => {
      if (!token) return null;
      return tokenPayload;
    });
    membership = jest.spyOn(app.get(IdpProjectionsFacade), 'getProjectForUser');
    tokenPayload = { userId: '0', projectId: '0', roles: ['admin'] };
    const res = await agent
      .post('/api/data-storages')
      .set(AUTH_HEADER)
      .send(new StorageBuilder().build());
    expect(res.status).toBe(201);
    storage = await db.getRepository(DataStorage).findOneByOrFail({ id: res.body.id });
    const repo = db.getRepository(DataMart);
    async function seed(
      title: string,
      projectId = 'target',
      connectorName: string | null = 'Admicro'
    ) {
      return repo.save(
        repo.create({
          title,
          projectId,
          storage,
          createdById: '0',
          status: DataMartStatus.DRAFT,
          definitionType: connectorName
            ? DataMartDefinitionType.CONNECTOR
            : DataMartDefinitionType.SQL,
          definition: connectorName
            ? {
                connector: {
                  source: {
                    name: connectorName,
                    configuration: [{ secret: 'never-expose-this' }],
                    node: 'metrics',
                    fields: ['id'],
                  },
                  storage: { fullyQualifiedName: 'test.table' },
                },
              }
            : { sqlQuery: 'SELECT 1' },
          availableForReporting: true,
          availableForMaintenance: true,
        })
      );
    }
    visible = await seed('Shared Admicro');
    hidden = await seed('Private Facebook', 'target', 'FacebookAds');
    owner = await seed('Owned Google', 'target', 'GoogleAds');
    await repo.update(hidden.id, { availableForReporting: false, availableForMaintenance: false });
    await repo.update(owner.id, { availableForReporting: false, availableForMaintenance: false });
    await db.getRepository(DataMartTechnicalOwner).save({ dataMartId: owner.id, userId: '0' });
    for (let i = 0; i < 6; i++) await seed(`SQL ${i}`, 'target', null);
    const other = await seed('Other tenant', 'other', 'OtherConnector');
    const deleted = await seed('Deleted connector', 'target', 'DeletedConnector');
    await repo.softDelete(deleted.id);
    const runRepo = db.getRepository(DataMartRun);
    for (const [dataMart, status, type] of [
      [visible, DataMartRunStatus.RUNNING, DataMartRunType.CONNECTOR],
      [hidden, DataMartRunStatus.RUNNING, DataMartRunType.CONNECTOR],
      [owner, DataMartRunStatus.RUNNING, DataMartRunType.CONNECTOR],
      [other, DataMartRunStatus.RUNNING, DataMartRunType.CONNECTOR],
      [deleted, DataMartRunStatus.RUNNING, DataMartRunType.CONNECTOR],
      [visible, DataMartRunStatus.PENDING, DataMartRunType.CONNECTOR],
      [visible, DataMartRunStatus.SUCCESS, DataMartRunType.CONNECTOR],
      [visible, DataMartRunStatus.FAILED, DataMartRunType.CONNECTOR],
      [visible, DataMartRunStatus.RUNNING, DataMartRunType.EMAIL],
    ] as const) {
      await runRepo.save(
        runRepo.create({
          dataMartId: dataMart.id,
          status,
          type,
          runType: RunType.manual,
          createdById: '0',
        })
      );
    }
  }, 300_000);

  beforeEach(() => {
    tokenPayload = { userId: '0', projectId: '0', roles: ['admin'] };
    membership.mockReset().mockImplementation(async (_userId: string, projectId: string) => ({
      id: projectId,
      title: 'Target',
      status: 'active',
      roles: ['admin'],
    }));
  });

  afterAll(async () => {
    if (app) await closeTestApp(app);
  });

  it('returns exact totals beyond the preview, scoped providers and only running connector runs', async () => {
    const res = await agent.get('/api/project-overviews/target').set(AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.dataMartsCount).toBe(9);
    expect(res.body.dataMarts).toHaveLength(5);
    expect(res.body.connectors).toEqual([
      { name: 'Admicro', dataMartsCount: 1 },
      { name: 'FacebookAds', dataMartsCount: 1 },
      { name: 'GoogleAds', dataMartsCount: 1 },
    ]);
    expect(res.body.runningSyncsCount).toBe(3);
    expect(res.body.observedAt).toMatch(/Z$/);
    expect(JSON.stringify(res.body)).not.toContain('never-expose-this');
    expect(JSON.stringify(res.body)).not.toContain('configuration');
    expect(JSON.stringify(res.body)).not.toContain('OtherConnector');
    expect(JSON.stringify(res.body)).not.toContain('DeletedConnector');
    expect(membership).toHaveBeenCalledWith('0', 'target');
  });

  it('uses the target role, not the active-project admin claim, for every summary field', async () => {
    membership.mockResolvedValue({ id: 'target', status: 'active', roles: ['viewer'] });
    const res = await agent.get('/api/project-overviews/target').set(AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.dataMartsCount).toBe(8);
    expect(res.body.runningSyncsCount).toBe(2);
    expect(res.body.connectors.map((c: { name: string }) => c.name)).toEqual([
      'Admicro',
      'GoogleAds',
    ]);
  });

  it('honors selected contexts and owner access for counts, previews, providers and runs', async () => {
    membership.mockResolvedValue({ id: 'target', status: 'active', roles: ['viewer'] });
    const context = await db.getRepository(Context).save({ name: 'Assigned', projectId: 'target' });
    await db
      .getRepository(MemberRoleScope)
      .save({ userId: '0', projectId: 'target', roleScope: RoleScope.SELECTED_CONTEXTS });
    await db
      .getRepository(MemberRoleContext)
      .save({ userId: '0', projectId: 'target', contextId: context.id });
    await db.getRepository(DataMartContext).save({ dataMartId: visible.id, contextId: context.id });
    const res = await agent.get('/api/project-overviews/target').set(AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.dataMartsCount).toBe(2);
    expect(res.body.dataMarts.map((dm: { id: string }) => dm.id).sort()).toEqual(
      [visible.id, owner.id].sort()
    );
    expect(res.body.runningSyncsCount).toBe(2);
    expect(res.body.connectors.map((c: { name: string }) => c.name)).toEqual([
      'Admicro',
      'GoogleAds',
    ]);
  });

  it('allows archived project reads for existing members', async () => {
    membership.mockResolvedValue({
      id: 'target',
      status: 'blocked',
      archived: true,
      roles: ['admin'],
    });
    expect((await agent.get('/api/project-overviews/target').set(AUTH_HEADER)).status).toBe(200);
  });

  it.each([
    { id: 'target', status: 'blocked', roles: [] },
    { id: 'target', status: 'blocked', roles: ['admin'] },
    { id: 'target', status: 'removed', roles: ['admin'] },
    { id: 'wrong-project', status: 'active', roles: ['admin'] },
  ])('fails closed for inaccessible membership %j', async project => {
    membership.mockResolvedValue(project);
    expect((await agent.get('/api/project-overviews/target').set(AUTH_HEADER)).status).toBe(403);
  });

  it('does not degrade IDP failure into an empty successful summary', async () => {
    membership.mockRejectedValue(new Error('IDP unavailable'));
    expect((await agent.get('/api/project-overviews/target').set(AUTH_HEADER)).status).toBe(500);
  });

  it('requires authentication', async () => {
    expect((await agent.get('/api/project-overviews/target')).status).toBe(401);
  });

  it.each(['api_key', 'plugin'])('rejects project-bound %s credentials', async authFlow => {
    tokenPayload = {
      ...tokenPayload,
      authFlow,
      apiKeyId: 'key',
      pluginId: 'plugin',
      installationId: 'install',
    };
    expect((await agent.get('/api/project-overviews/target').set(AUTH_HEADER)).status).toBe(403);
    expect(membership).not.toHaveBeenCalled();
  });

  it('restricts view-only tokens to the active project', async () => {
    tokenPayload = { ...tokenPayload, viewOnly: true };
    expect((await agent.get('/api/project-overviews/target').set(AUTH_HEADER)).status).toBe(403);
    expect(membership).not.toHaveBeenCalled();
  });
});
