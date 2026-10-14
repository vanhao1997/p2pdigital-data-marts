import { ApiService } from '../../../../services';
import type {
  ProjectSettings,
  UpdateProjectDescriptionRequest,
  UpdateProjectLogoRequest,
} from '../types';

export class ProjectSettingsApiService extends ApiService {
  constructor() {
    super('/projects/settings');
  }

  async getSettings(): Promise<ProjectSettings> {
    return this.get<ProjectSettings>('');
  }

  async updateDescription(description: string | null): Promise<ProjectSettings> {
    const request: UpdateProjectDescriptionRequest = { description };
    return this.put<ProjectSettings>('/description', request);
  }

  async updateLogo(logoUrl: string | null): Promise<ProjectSettings> {
    const request: UpdateProjectLogoRequest = { logoUrl };
    return this.put<ProjectSettings>('/logo', request);
  }
}

export const projectSettingsApiService = new ProjectSettingsApiService();
