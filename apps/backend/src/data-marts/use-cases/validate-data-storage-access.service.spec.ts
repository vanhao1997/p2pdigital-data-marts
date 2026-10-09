jest.mock('typeorm-transactional', () => ({ Transactional: () => () => undefined }));
jest.mock('../data-storage-types/data-storage-credentials-resolver.service', () => ({
  DataStorageCredentialsResolver: jest.fn(),
}));
jest.mock('../data-storage-types/facades/data-storage-access-validator-facade.service', () => ({
  DataStorageAccessValidatorFacade: jest.fn(),
}));
jest.mock('../services/data-storage.service', () => ({ DataStorageService: jest.fn() }));
jest.mock('../services/access-decision/access-decision.service', () => ({
  AccessDecisionService: jest.fn(),
}));

import { Logger } from '@nestjs/common';
import { CredentialsExpiredException } from '../exceptions/google-oauth.exceptions';
import { ValidationResultCode } from '../data-storage-types/interfaces/data-storage-access-validator.interface';
import { ValidateDataStorageAccessService } from './validate-data-storage-access.service';

describe('ValidateDataStorageAccessService', () => {
  const command = { id: 'storage', projectId: 'project', userId: 'user', roles: ['editor'] };
  const storage = {
    id: 'storage',
    projectId: 'project',
    config: { projectId: 'warehouse' },
    credentialId: 'credential',
  };

  const setup = () => {
    const dataStorageService = { getByProjectIdAndId: jest.fn().mockResolvedValue(storage) };
    const dataStorageValidationFacade = {
      validateAccess: jest.fn().mockResolvedValue({ valid: true }),
    };
    const dataStorageCredentialsResolver = {
      resolve: jest.fn().mockResolvedValue({ private_key: 'secret' }),
    };
    const accessDecisionService = { canAccess: jest.fn().mockResolvedValue(true) };
    const service = new ValidateDataStorageAccessService(
      dataStorageService as never,
      dataStorageValidationFacade as never,
      dataStorageCredentialsResolver as never,
      accessDecisionService as never
    );
    return {
      service,
      dataStorageService,
      dataStorageValidationFacade,
      dataStorageCredentialsResolver,
    };
  };

  it('does not expose credential-resolution details', async () => {
    const { service, dataStorageCredentialsResolver } = setup();
    dataStorageCredentialsResolver.resolve.mockRejectedValue(
      new Error('private_key=never-return-this refresh_token=never-return-this')
    );
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const result = await service.run(command);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBe('Storage credentials could not be resolved.');
    expect(JSON.stringify(result)).not.toContain('never-return-this');
    expect(warn).toHaveBeenCalledWith('Failed to resolve credentials for storage storage');
    expect(warn.mock.calls.flat().map(String).join(' ')).not.toContain('never-return-this');
    warn.mockRestore();
  });

  it('keeps OAuth reauthorization state machine intact', async () => {
    const { service, dataStorageCredentialsResolver } = setup();
    dataStorageCredentialsResolver.resolve.mockRejectedValue(
      new CredentialsExpiredException('storage', 'storage')
    );
    const result = await service.run(command);
    expect(result.code).toBe(ValidationResultCode.OAUTH_REAUTH_REQUIRED);
    expect(result.errorMessage).not.toContain('secret');
  });
});
