import { describe, expect, it, jest } from '@jest/globals';
import { BusinessViolationException } from '../../common/exceptions/business-violation.exception';
import { DeleteInsightTemplateService } from './delete-insight-template.service';

const command = { insightTemplateId: 'template-1', dataMartId: 'dm-1', projectId: 'project-1' };

describe('DeleteInsightTemplateService', () => {
  function create() {
    const insightTemplateService = {
      getByIdAndDataMartIdAndProjectId: jest
        .fn()
        .mockResolvedValue({ id: command.insightTemplateId }),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    const triggerService = { countForInsightTemplate: jest.fn().mockResolvedValue(0) };
    const reportService = { countByInsightTemplate: jest.fn().mockResolvedValue(0) };
    return {
      service: new DeleteInsightTemplateService(
        insightTemplateService as never,
        triggerService as never,
        reportService as never
      ),
      insightTemplateService,
      triggerService,
      reportService,
    };
  }

  it('blocks deletion while scheduled runs exist', async () => {
    const { service, triggerService, insightTemplateService } = create();
    triggerService.countForInsightTemplate.mockResolvedValue(2);
    await expect(service.run(command as never)).rejects.toBeInstanceOf(BusinessViolationException);
    expect(insightTemplateService.softDelete).not.toHaveBeenCalled();
  });

  it('soft-deletes when no scheduled runs exist', async () => {
    const { service, insightTemplateService, triggerService } = create();
    await service.run(command as never);
    expect(triggerService.countForInsightTemplate).toHaveBeenCalledWith(command);
    expect(insightTemplateService.softDelete).toHaveBeenCalledWith(command.insightTemplateId);
  });

  it('blocks deletion while reports reference the template', async () => {
    const { service, insightTemplateService, reportService } = create();
    reportService.countByInsightTemplate.mockResolvedValue(1);
    await expect(service.run(command as never)).rejects.toBeInstanceOf(BusinessViolationException);
    expect(insightTemplateService.softDelete).not.toHaveBeenCalled();
  });
});
