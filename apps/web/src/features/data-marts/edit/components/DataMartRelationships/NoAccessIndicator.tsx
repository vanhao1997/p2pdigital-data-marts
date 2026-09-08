import { Tooltip, TooltipContent, TooltipTrigger } from '@owox/ui/components/tooltip';
import { cn } from '@owox/ui/lib/utils';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Variant = 'muted' | 'destructive';

const VARIANT_COLOR: Record<Variant, string> = {
  muted: 'text-muted-foreground/70',
  destructive: 'text-destructive',
};

interface NoAccessIndicatorProps {
  variant?: Variant;
  className?: string;
}

export function NoAccessIndicator({ variant = 'muted', className }: NoAccessIndicatorProps = {}) {
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TriangleAlert
          className={cn(VARIANT_COLOR[variant], 'size-4 shrink-0', className)}
          aria-label={t('dataMartRelationships.noAccessAria')}
        />
      </TooltipTrigger>
      <TooltipContent side='top' className='max-w-xs'>
        {t('dataMartRelationships.noAccessTooltip')}
      </TooltipContent>
    </Tooltip>
  );
}

export function NoAccessIndicatorNative() {
  const { t } = useTranslation();

  return (
    <span
      className={cn(VARIANT_COLOR.muted, 'inline-flex shrink-0')}
      title={t('dataMartRelationships.noAccessTooltip')}
      aria-label={t('dataMartRelationships.noAccessAria')}
    >
      <TriangleAlert style={{ width: 14, height: 14 }} />
    </span>
  );
}
