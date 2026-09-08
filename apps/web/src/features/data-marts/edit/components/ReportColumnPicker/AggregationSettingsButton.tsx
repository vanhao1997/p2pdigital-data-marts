import { Sigma } from 'lucide-react';
import { Badge } from '@owox/ui/components/badge';
import { Button } from '@owox/ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@owox/ui/components/tooltip';
import { cn } from '@owox/ui/lib/utils';
import { useTranslation } from 'react-i18next';

interface AggregationSettingsButtonProps {
  active: boolean;
  open: boolean;
  onClick: () => void;
  count?: number;
}

export function AggregationSettingsButton({
  active,
  open,
  onClick,
  count,
}: AggregationSettingsButtonProps) {
  const { t } = useTranslation();
  const aggregationsLabel = t('reportColumnPicker.aggregations', 'Aggregations');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          variant={open ? 'secondary' : 'ghost'}
          size='sm'
          aria-label={aggregationsLabel}
          aria-expanded={open}
          onClick={onClick}
          className='relative h-7 w-7 gap-1'
        >
          <Sigma className={cn('h-3.5 w-3.5', active && 'text-blue-500')} />
          {typeof count === 'number' && count > 0 && (
            <Badge
              variant='default'
              aria-label={t('reportColumnPicker.aggregationsCount', 'Aggregations count')}
              className='pointer-events-none absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[8px] leading-none'
            >
              {count}
            </Badge>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {t('reportColumnPicker.aggregationsGrouping', 'Aggregations & grouping')}
      </TooltipContent>
    </Tooltip>
  );
}
