jest.mock(
  '../../../common/producer/producer.module.js',
  () => ({
    ProducerModule: function ProducerModule() {
      return undefined;
    },
  }),
  { virtual: true }
);
jest.mock(
  '../../../idp/guards/idp.guard.js',
  () => ({
    IdpGuard: function IdpGuard() {
      return undefined;
    },
  }),
  { virtual: true }
);

import { Test } from '@nestjs/testing';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { PublicOriginService } from '../../../common/config/public-origin.service';
import { CommonModule } from '../../../common/common.module';
import { ClsContextService } from '../../../common/logger/cls-context.service';
import { SystemTimeService } from '../../../common/scheduler/services/system-time.service';
import { SEARCH_FACADE } from '../../../common/search/search.facade';
import { MCP_DATA_DESTINATIONS_FACADE } from '../../../data-marts/facades/mcp-data-destinations.facade';
import { MCP_DATA_MARTS_FACADE } from '../../../data-marts/facades/mcp-data-marts.facade';
import { MCP_REPORTS_FACADE } from '../../../data-marts/facades/mcp-reports.facade';
import { MCP_SCHEDULED_TRIGGERS_FACADE } from '../../../data-marts/facades/mcp-scheduled-triggers.facade';
import { MCP_SETUP_STORAGES_FACADE } from '../../../data-marts/facades/mcp-setup-storages.facade';
import { MCP_SETUP_DATA_MARTS_FACADE } from '../../../data-marts/facades/mcp-setup-data-marts.facade';
import { DataMartsModule } from '../../../data-marts/data-marts.module';
import { MCP_PROJECT_CONTEXT_FACADE } from '../../../idp/facades/mcp-project-context.facade';
import { IdpModule } from '../../../idp/idp.module';
import { ProjectSettingsModule } from '../../../project-settings/project-settings.module';
import { PROJECT_SETTINGS_FACADE } from '../../../project-settings/facades/project-settings.facade';
import { EeModule } from '../../ee.module';
import { MCP_TOOL_DEFINITIONS, type McpToolDefinition } from './mcp-tool.definition';
import { MCP_TOOL_DEFINITIONS_PROVIDER, MCP_TOOL_PROVIDER_CLASSES } from './mcp-tool.providers';

describe('MCP tool providers', () => {
  function moduleMetadata<T>(key: string, module: unknown): T[] {
    return (Reflect.getMetadata(key, module) ?? []) as T[];
  }

  it('keeps the real EeModule import/export boundary wired for MCP tools', () => {
    expect(moduleMetadata(MODULE_METADATA.IMPORTS, EeModule)).toEqual(
      expect.arrayContaining([IdpModule, DataMartsModule, CommonModule, ProjectSettingsModule])
    );
    expect(moduleMetadata(MODULE_METADATA.EXPORTS, DataMartsModule)).toEqual(
      expect.arrayContaining([
        MCP_DATA_MARTS_FACADE,
        MCP_DATA_DESTINATIONS_FACADE,
        MCP_REPORTS_FACADE,
        MCP_SCHEDULED_TRIGGERS_FACADE,
        MCP_SETUP_STORAGES_FACADE,
        MCP_SETUP_DATA_MARTS_FACADE,
      ])
    );
    expect(moduleMetadata(MODULE_METADATA.EXPORTS, IdpModule)).toContain(
      MCP_PROJECT_CONTEXT_FACADE
    );
    expect(moduleMetadata(MODULE_METADATA.EXPORTS, CommonModule)).toContain(PublicOriginService);
    expect(moduleMetadata(MODULE_METADATA.EXPORTS, ProjectSettingsModule)).toContain(
      PROJECT_SETTINGS_FACADE
    );
  });

  it('resolves report run tools through the real Nest provider wiring', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ...MCP_TOOL_PROVIDER_CLASSES,
        MCP_TOOL_DEFINITIONS_PROVIDER,
        { provide: MCP_DATA_MARTS_FACADE, useValue: {} },
        { provide: MCP_DATA_DESTINATIONS_FACADE, useValue: {} },
        { provide: MCP_REPORTS_FACADE, useValue: {} },
        { provide: MCP_SCHEDULED_TRIGGERS_FACADE, useValue: {} },
        { provide: MCP_SETUP_STORAGES_FACADE, useValue: {} },
        { provide: MCP_SETUP_DATA_MARTS_FACADE, useValue: {} },
        { provide: MCP_PROJECT_CONTEXT_FACADE, useValue: {} },
        { provide: PROJECT_SETTINGS_FACADE, useValue: {} },
        { provide: SEARCH_FACADE, useValue: {} },
        {
          provide: PublicOriginService,
          useValue: { getPublicOrigin: () => 'https://app.example.test' },
        },
        {
          provide: SystemTimeService,
          useValue: { now: () => new Date('2026-07-01T10:00:00.000Z') },
        },
        {
          provide: ClsContextService,
          useValue: { get: () => undefined, set: () => {}, update: () => {} },
        },
      ],
    }).compile();

    try {
      const tools = moduleRef.get<McpToolDefinition[]>(MCP_TOOL_DEFINITIONS);
      const toolNames = tools.map(tool => tool.name);

      expect(toolNames).toEqual(expect.arrayContaining(['run_report', 'get_report_run_status']));
      expect(toolNames).toHaveLength(30);
      expect(new Set(toolNames).size).toBe(30);
      expect(toolNames).toEqual(
        expect.arrayContaining([
          'list_data_storages',
          'list_connectors',
          'get_connector_specification',
          'get_connector_fields',
          'create_data_storage',
          'configure_data_storage',
          'validate_data_storage',
          'create_data_mart',
          'update_data_mart',
          'validate_data_mart',
          'publish_data_mart',
          'get_data_mart_setup_status',
        ])
      );
    } finally {
      await moduleRef.close();
    }
  });
});
