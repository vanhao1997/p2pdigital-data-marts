import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectSettings } from '../entities/project-settings.entity';

const MAX_LOGO_LENGTH = 512_000;

@Injectable()
export class ProjectSettingsService {
  private logoColumnReady = false;

  constructor(
    @InjectRepository(ProjectSettings)
    private readonly repository: Repository<ProjectSettings>
  ) {}

  private async ensureLogoColumn(): Promise<boolean> {
    if (typeof this.repository.query !== 'function') return false;
    if (this.logoColumnReady) return true;
    try {
      await this.repository.query('ALTER TABLE project_settings ADD COLUMN logoUrl TEXT NULL');
    } catch {
      // Column already exists
    }
    this.logoColumnReady = true;
    return true;
  }

  async findByProjectId(projectId: string): Promise<ProjectSettings | null> {
    const entity = await this.repository.findOne({ where: { projectId } });
    if (entity && (await this.ensureLogoColumn())) {
      try {
        const rows = (await this.repository.query(
          'SELECT logoUrl FROM project_settings WHERE projectId = ?',
          [projectId]
        )) as Array<{ logoUrl?: string | null }>;
        entity.logoUrl = rows?.[0]?.logoUrl ?? null;
      } catch {
        entity.logoUrl = null;
      }
    }
    return entity;
  }

  async saveDescription(projectId: string, description: string | null): Promise<ProjectSettings> {
    const settings =
      (await this.findByProjectId(projectId)) ?? this.repository.create({ projectId });
    settings.description = description;
    return this.repository.save(settings);
  }

  async saveLogo(projectId: string, rawLogoUrl: string | null): Promise<ProjectSettings> {
    const logoUrl = rawLogoUrl?.trim() || null;
    if (logoUrl !== null) {
      if (logoUrl.length > MAX_LOGO_LENGTH) {
        throw new BadRequestException('Project logo is too large (max 500 KB)');
      }
      if (!/^(https?:\/\/|\/|data:image\/[a-zA-Z0-9.+-]+;base64,)/i.test(logoUrl)) {
        throw new BadRequestException('Project logo must be an image URL or data:image URI');
      }
    }
    const existing = await this.repository.findOne({ where: { projectId } });
    const settings =
      existing ??
      (await this.repository.save(this.repository.create({ projectId, description: null })));
    if (await this.ensureLogoColumn()) {
      await this.repository.query('UPDATE project_settings SET logoUrl = ? WHERE projectId = ?', [
        logoUrl,
        projectId,
      ]);
    }
    settings.logoUrl = logoUrl;
    return settings;
  }
}
