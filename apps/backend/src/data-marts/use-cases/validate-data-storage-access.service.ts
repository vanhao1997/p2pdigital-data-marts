import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { DataStorageAccessValidatorFacade } from '../data-storage-types/facades/data-storage-access-validator-facade.service';
import { DataStorageCredentialsResolver } from '../data-storage-types/data-storage-credentials-resolver.service';
import { ValidationResult } from '../data-storage-types/interfaces/data-storage-access-validator.interface';
import { ValidateDataStorageAccessCommand } from '../dto/domain/validate-data-storage-access.command';
import { DataStorageService } from '../services/data-storage.service';
import { AccessDecisionService, EntityType, Action } from '../services/access-decision';
import { CredentialsExpiredException } from '../exceptions/google-oauth.exceptions';

const GOOGLE_OAUTH_REAUTH_MESSAGE =
  'Google authorization could not be refreshed. Reconnect this Storage to restore access.';

@Injectable()
export class ValidateDataStorageAccessService {
  private readonly logger = new Logger(ValidateDataStorageAccessService.name);

  constructor(
    private readonly dataStorageService: DataStorageService,
    private readonly dataStorageValidationFacade: DataStorageAccessValidatorFacade,
    private readonly dataStorageCredentialsResolver: DataStorageCredentialsResolver,
    private readonly accessDecisionService: AccessDecisionService
  ) {}

  async run(command: ValidateDataStorageAccessCommand): Promise<ValidationResult> {
    const dataStorage = await this.dataStorageService.getByProjectIdAndId(
      command.projectId,
      command.id
    );

    if (command.userId) {
      const canUse = await this.accessDecisionService.canAccess(
        command.userId,
        command.roles,
        EntityType.STORAGE,
        command.id,
        Action.USE,
        command.projectId
      );
      if (!canUse) {
        throw new ForbiddenException('You do not have access to this Storage');
      }
    }

    if (!dataStorage.config) {
      return ValidationResult.unconfigured('Complete setup to activate Storage');
    }

    if (dataStorage.credentialId) {
      try {
        const resolvedCredentials = await this.dataStorageCredentialsResolver.resolve(dataStorage);
        return await this.dataStorageValidationFacade.validateAccess(
          dataStorage.type,
          dataStorage.config,
          resolvedCredentials
        );
      } catch (error) {
        // Do not pass provider/credential errors as logger metadata: SDK errors may
        // contain private keys, tokens, connection URLs, or provider payloads.
        this.logger.warn(`Failed to resolve credentials for storage ${dataStorage.id}`);
        if (error instanceof CredentialsExpiredException) {
          return ValidationResult.oauthReauthRequired(GOOGLE_OAUTH_REAUTH_MESSAGE);
        }
        return ValidationResult.failure('Storage credentials could not be resolved.');
      }
    }

    return ValidationResult.unconfigured('Complete setup to activate Storage');
  }
}
