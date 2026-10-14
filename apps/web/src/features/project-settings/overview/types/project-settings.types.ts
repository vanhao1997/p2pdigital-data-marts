export interface ProjectSettings {
  description: string | null;
  logoUrl?: string | null;
}

export interface UpdateProjectDescriptionRequest {
  description: string | null;
}

export interface UpdateProjectLogoRequest {
  logoUrl: string | null;
}
