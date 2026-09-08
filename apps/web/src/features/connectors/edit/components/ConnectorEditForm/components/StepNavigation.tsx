import { Button } from '@owox/ui/components/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  canGoNext: boolean;
  canGoBack: boolean;
  isLoading?: boolean;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
  nextLabel?: string;
  backLabel?: string;
  finishLabel?: string;
}

export function StepNavigation({
  currentStep,
  totalSteps,
  canGoNext,
  canGoBack,
  isLoading = false,
  onNext,
  onBack,
  onFinish,
  nextLabel,
  backLabel,
  finishLabel,
}: StepNavigationProps) {
  const { t } = useTranslation();
  const resolvedNextLabel = nextLabel ?? t('common.next');
  const resolvedBackLabel = backLabel ?? t('common.back');
  const resolvedFinishLabel = finishLabel ?? t('common.save');
  const isLastStep = currentStep === totalSteps;

  // Single-step layout
  if (totalSteps === 1) {
    return (
      <div className='w-full'>
        <Button
          className='w-full'
          variant='default'
          onClick={onFinish}
          disabled={!canGoNext || isLoading}
        >
          {resolvedFinishLabel}
        </Button>
      </div>
    );
  }

  // Multi-step layout
  return (
    <div className='flex w-full items-center justify-between gap-4'>
      <div className='flex-1'>
        {canGoBack && (
          <Button variant='outline' onClick={onBack} disabled={isLoading}>
            <ChevronLeft className='h-4 w-4' />
            {resolvedBackLabel}
          </Button>
        )}
      </div>

      <div className='text-muted-foreground/75 px-4 text-sm'>
        {t('common.stepOf', { current: currentStep, total: totalSteps })}
      </div>

      <div className='flex flex-1 justify-end'>
        {isLastStep ? (
          <Button variant='default' onClick={onFinish} disabled={!canGoNext || isLoading}>
            {resolvedFinishLabel}
          </Button>
        ) : (
          <Button variant='default' onClick={onNext} disabled={!canGoNext || isLoading}>
            {resolvedNextLabel}
            <ChevronRight className='h-4 w-4' />
          </Button>
        )}
      </div>
    </div>
  );
}
