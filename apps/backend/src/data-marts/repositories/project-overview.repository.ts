import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataMart } from '../entities/data-mart.entity';
import { DataMartRun } from '../entities/data-mart-run.entity';
import { DataMartDefinitionType } from '../enums/data-mart-definition-type.enum';
import { DataMartRunStatus } from '../enums/data-mart-run-status.enum';
import { DataMartRunType } from '../enums/data-mart-run-type.enum';
import { DataMartStatus } from '../enums/data-mart-status.enum';
import {
  DataMartVisibilityFilterOptions,
  applyDataMartVisibilityFilter,
} from '../utils/apply-data-mart-visibility-filter';

export interface ProjectOverviewRows {
  total: number;
  dataMarts: { id: string; title: string; status: DataMartStatus }[];
  connectors: { name: string; count: string | number }[];
  runningSyncs: number;
}

@Injectable()
export class ProjectOverviewRepository {
  constructor(
    @InjectRepository(DataMart) private readonly dataMartRepository: Repository<DataMart>,
    @InjectRepository(DataMartRun) private readonly runRepository: Repository<DataMartRun>
  ) {}

  async readVisible(options: DataMartVisibilityFilterOptions): Promise<ProjectOverviewRows> {
    const visible = this.dataMartRepository
      .createQueryBuilder('dm')
      .where('dm.projectId = :projectId', { projectId: options.projectId })
      .andWhere('dm.deletedAt IS NULL');
    applyDataMartVisibilityFilter(visible, { ...options, dataMartAlias: 'dm' });

    // Extract only the provider identifier, never its credential-bearing configuration.
    const nameSql =
      this.dataMartRepository.manager.connection.options.type === 'mysql'
        ? "JSON_UNQUOTE(JSON_EXTRACT(dm.definition, '$.connector.source.name'))"
        : "json_extract(dm.definition, '$.connector.source.name')";
    const connectorQuery = visible
      .clone()
      .andWhere('dm.definitionType = :definitionType', {
        definitionType: DataMartDefinitionType.CONNECTOR,
      })
      .andWhere(`${nameSql} IS NOT NULL`)
      .andWhere(`${nameSql} != ''`)
      .select(nameSql, 'name')
      .addSelect('COUNT(*)', 'count')
      .groupBy(nameSql)
      .orderBy(nameSql, 'ASC');
    const runs = this.runRepository
      .createQueryBuilder('run')
      .innerJoin('run.dataMart', 'dm')
      .where('dm.projectId = :projectId', { projectId: options.projectId })
      .andWhere('dm.deletedAt IS NULL')
      .andWhere('run.type = :runType', { runType: DataMartRunType.CONNECTOR })
      .andWhere('run.status = :runStatus', { runStatus: DataMartRunStatus.RUNNING });
    applyDataMartVisibilityFilter(runs, { ...options, dataMartAlias: 'dm' });

    const [total, dataMarts, connectors, runningSyncs] = await Promise.all([
      visible.clone().getCount(),
      visible
        .clone()
        .select('dm.id', 'id')
        .addSelect('dm.title', 'title')
        .addSelect('dm.status', 'status')
        .orderBy('dm.createdAt', 'DESC')
        .addOrderBy('dm.id', 'ASC')
        .limit(5)
        .getRawMany<ProjectOverviewRows['dataMarts'][number]>(),
      connectorQuery.getRawMany<ProjectOverviewRows['connectors'][number]>(),
      runs.getCount(),
    ]);
    return { total, dataMarts, connectors, runningSyncs };
  }
}
