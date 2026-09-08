import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@owox/ui/components/popover';
import { Accordion } from '@owox/ui/components/accordion';
import { SetupChecklistGroup } from './SetupChecklistGroup';
import { SetupStepAccordion } from './SetupStepAccordion';
import { getSetupSteps } from './items';
import type { GroupProgress, ProjectSetupProgress } from './types';
import { formatDateShort } from '../../../utils/date-formatters';
import { GroupStatusType } from './types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@owox/ui/components/tooltip';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SetupGroupPopoverProps {
  groupProgress: GroupProgress;
  progress: ProjectSetupProgress;
}

export function SetupGroupPopover({ groupProgress, progress }: SetupGroupPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
  const { group, status, completedCount, totalCount, completedAt } = groupProgress;

  const setupSteps = useMemo(() => getSetupSteps(t), [t]);

  const groupSteps = useMemo(() => {
    const stepIdsSet = new Set(group.stepIds);
    return setupSteps.filter(step => stepIdsSet.has(step.id));
  }, [group.stepIds, setupSteps]);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div>
          <SetupChecklistGroup
            groupProgress={groupProgress}
            onClick={() => {
              setIsOpen(true);
            }}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent side='right' align='start' className='w-96'>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-0.5'>
            <div className='flex items-center justify-between gap-2'>
              <h3 className='text-base font-semibold'>{group.title}</h3>
              {group.description && status !== GroupStatusType.DONE && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className='text-muted-foreground/75 hover:text-muted-foreground size-4 shrink-0' />
                  </TooltipTrigger>
                  <TooltipContent>{group.description}</TooltipContent>
                </Tooltip>
              )}
            </div>
            {status === GroupStatusType.DONE && completedAt ? (
              <p className='text-muted-foreground text-xs'>
                {t('setupChecklist.completedOn', { date: formatDateShort(completedAt) })}
              </p>
            ) : (
              <p className='text-muted-foreground text-xs'>
                {t('setupChecklist.completedCount', {
                  completed: completedCount,
                  total: totalCount,
                })}
              </p>
            )}
          </div>

          <Accordion
            type='single'
            className='border-border w-full overflow-hidden rounded-md border'
          >
            {groupSteps.map(step => (
              <SetupStepAccordion
                key={step.id}
                step={step}
                stepProgress={progress[step.progressKey]}
                onClose={handleClose}
              />
            ))}
          </Accordion>
        </div>
      </PopoverContent>
    </Popover>
  );
}
