import { Injectable } from '@nestjs/common';
import { DeleteInsightTemplateCommand } from '../dto/domain/delete-insight-template.command';
import { InsightTemplateService } from '../services/insight-template.service';
import { InsightTemplateRunTriggerService } from '../services/insight-template-run-trigger.service';
import { BusinessViolationException } from '../../common/exceptions/business-violation.exception';
import { ReportService } from '../services/report.service';

@Injectable()
export class DeleteInsightTemplateService {
  constructor(
    private readonly insightTemplateService: InsightTemplateService,
    private readonly triggerService: InsightTemplateRunTriggerService,
    private readonly reportService: ReportService
  ) {}

  async run(command: DeleteInsightTemplateCommand): Promise<void> {
    await this.insightTemplateService.getByIdAndDataMartIdAndProjectId(
      command.insightTemplateId,
      command.dataMartId,
      command.projectId
    );

    const triggerCount = await this.triggerService.countForInsightTemplate(command);
    if (triggerCount > 0) {
      throw new BusinessViolationException(
        'Cannot delete an insight template with scheduled runs',
        { triggerCount }
      );
    }
    const reportCount = await this.reportService.countByInsightTemplate(command);
    if (reportCount > 0) {
      throw new BusinessViolationException('Cannot delete an insight template used by reports', {
        reportCount,
      });
    }
    await this.insightTemplateService.softDelete(command.insightTemplateId);
  }
}
