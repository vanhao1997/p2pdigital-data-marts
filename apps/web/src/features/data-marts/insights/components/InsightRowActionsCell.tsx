import { useState } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@owox/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@owox/ui/components/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@owox/ui/components/tooltip';
import { useTranslation } from 'react-i18next';

interface InsightRowActionsCellProps {
  id: string;
  canDelete: boolean;
  onDelete: (id: string) => void;
}

export function InsightRowActionsCell({ id, canDelete, onDelete }: InsightRowActionsCellProps) {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div
      className='text-right'
      onClick={e => {
        e.stopPropagation();
      }}
    >
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className={`dm-card-table-body-row-actionbtn opacity-0 transition-opacity ${
              isMenuOpen ? 'opacity-100' : 'group-hover:opacity-100'
            }`}
            aria-label={t('insightsUi.rowActions', 'Insight actions')}
          >
            <MoreHorizontal className='dm-card-table-body-row-actionbtn-icon' />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align='end'>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className='w-full'>
                <DropdownMenuItem
                  className='text-destructive'
                  onClick={() => {
                    onDelete(id);
                  }}
                  disabled={!canDelete}
                >
                  <Trash2 className='h-4 w-4 text-red-600' />
                  <span className='text-red-600'>
                    {t('insightsUi.deleteInsight', 'Delete insight')}
                  </span>
                </DropdownMenuItem>
              </div>
            </TooltipTrigger>
            {!canDelete && <TooltipContent side='left'>{t('common.noPermission')}</TooltipContent>}
          </Tooltip>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
