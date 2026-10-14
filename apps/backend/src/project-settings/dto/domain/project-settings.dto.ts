export class ProjectSettingsDto {
  public readonly logoUrl?: string | null;

  constructor(
    public readonly projectId: string,
    public readonly description: string | null,
    logoUrl?: string | null
  ) {
    if (logoUrl !== undefined) {
      this.logoUrl = logoUrl;
    }
  }
}
