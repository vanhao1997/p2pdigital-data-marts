import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@owox/ui/components/alert-dialog';
import { Badge } from '@owox/ui/components/badge';
import { Button } from '@owox/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@owox/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@owox/ui/components/dropdown-menu';
import {
  CalendarClock,
  ChevronDown,
  CircleCheckBig,
  Layers,
  PauseCircle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { isVietnameseLocale } from '../../../../../shared/utils/field-humanizer';
import { ScheduleConfig } from '../../components/ScheduleConfig/ScheduleConfig';
import type { ProjectScheduledTrigger } from '../../model/scheduled-trigger.model';
import {
  bulkDeleteTriggers,
  bulkToggleTriggersActive,
  bulkUpdateTriggersSchedule,
} from '../trigger-group-sync.service';
import type { TriggerGroupDraft } from '../trigger-group.model';

export interface ScheduledTriggerBulkActionsProps {
  selectedTriggers: ProjectScheduledTrigger[];
  onCompleted: () => Promise<void> | void;
  onClearSelection: () => void;
  onGroupSelectedTriggers: (draft: Partial<TriggerGroupDraft>) => void;
}

export function ScheduledTriggerBulkActions({
  selectedTriggers,
  onCompleted,
  onClearSelection,
  onGroupSelectedTriggers,
}: ScheduledTriggerBulkActionsProps) {
  const { t } = useTranslation();
  const isVi = isVietnameseLocale();

  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [bulkCron, setBulkCron] = useState(
    selectedTriggers.length > 0 ? selectedTriggers[0].cronExpression : '0 9 * * *'
  );
  const [bulkTimeZone, setBulkTimeZone] = useState(
    selectedTriggers.length > 0 ? selectedTriggers[0].timeZone : 'UTC'
  );
  const [bulkIsActive, setBulkIsActive] = useState(
    selectedTriggers.length > 0 ? selectedTriggers[0].isActive : true
  );

  if (selectedTriggers.length === 0) return null;

  const firstTrigger = selectedTriggers[0];
  const editableTriggers = selectedTriggers.filter(item => item.canEdit);
  const deletableTriggers = selectedTriggers.filter(item => item.canDelete);

  const handleOpenBulkSchedule = () => {
    setBulkCron(firstTrigger.cronExpression);
    setBulkTimeZone(firstTrigger.timeZone);
    setBulkIsActive(firstTrigger.isActive);
    setShowScheduleDialog(true);
  };

  const handleApplyBulkSchedule = async () => {
    if (editableTriggers.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const { updatedCount, failedCount } = await bulkUpdateTriggersSchedule(editableTriggers, {
        cronExpression: bulkCron,
        timeZone: bulkTimeZone,
        isActive: bulkIsActive,
      });
      if (updatedCount > 0) {
        toast.success(
          isVi
            ? `Đã cập nhật lịch chạy chung cho ${updatedCount} trigger`
            : `Updated schedule for ${updatedCount} triggers`
        );
      }
      if (failedCount > 0) {
        toast.error(
          isVi
            ? `Không thể cập nhật ${failedCount} trigger`
            : `Failed to update ${failedCount} triggers`
        );
      }
      setShowScheduleDialog(false);
      onClearSelection();
      await onCompleted();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkToggle = async (nextActive: boolean) => {
    if (editableTriggers.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const { updatedCount } = await bulkToggleTriggersActive(editableTriggers, nextActive);
      toast.success(
        isVi
          ? `${nextActive ? 'Đã bật' : 'Đã tắt'} ${updatedCount} trigger đã chọn`
          : `${nextActive ? 'Enabled' : 'Disabled'} ${updatedCount} selected triggers`
      );
      onClearSelection();
      await onCompleted();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (deletableTriggers.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const { deletedCount } = await bulkDeleteTriggers(deletableTriggers);
      if (deletedCount > 0) {
        toast.success(
          isVi ? `Đã xóa ${deletedCount} trigger` : `Deleted ${deletedCount} triggers`
        );
      }
      setShowDeleteConfirm(false);
      onClearSelection();
      await onCompleted();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGroupSelection = () => {
    const uniqueDataMartIds = Array.from(new Set(selectedTriggers.map(item => item.dataMart.id)));
    const uniqueTypes = Array.from(new Set(selectedTriggers.map(item => item.type)));
    const dmTitles = Array.from(new Set(selectedTriggers.map(item => item.dataMart.title)));

    onGroupSelectedTriggers({
      name: isVi
        ? `Bộ Trigger (${dmTitles.slice(0, 2).join(', ')})`
        : `Trigger Group (${dmTitles.slice(0, 2).join(', ')})`,
      dataMartIds: uniqueDataMartIds,
      triggerTypes: uniqueTypes,
      cronExpression: firstTrigger.cronExpression,
      timeZone: firstTrigger.timeZone,
      isActive: firstTrigger.isActive,
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            data-testid='scheduledTriggerBulkActionsBtn'
          >
            <span>{t('dataMartBulkActions.actions', isVi ? 'Thao tác' : 'Actions')}</span>
            <Badge
              variant='secondary'
              className='bg-muted text-muted-foreground rounded-full border-transparent px-1.5 py-0 text-xs'
            >
              {selectedTriggers.length}
            </Badge>
            <ChevronDown className='h-4 w-4' aria-hidden='true' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start'>
          <DropdownMenuItem
            onSelect={handleGroupSelection}
            data-testid='bulkGroupSelectedTriggers'
          >
            <Layers aria-hidden='true' />
            {isVi
              ? 'Gom thành Bộ Trigger nhóm...'
              : 'Group into Trigger Group...'}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={editableTriggers.length === 0 || isProcessing}
            onSelect={handleOpenBulkSchedule}
            data-testid='bulkEditTriggerSchedule'
          >
            <CalendarClock aria-hidden='true' />
            {isVi
              ? 'Đặt lịch chạy chung cho các dòng đã chọn...'
              : 'Set shared schedule for selected...'}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={editableTriggers.length === 0 || isProcessing}
            onSelect={() => {
              void handleBulkToggle(true);
            }}
            data-testid='bulkEnableTriggers'
          >
            <CircleCheckBig aria-hidden='true' />
            {isVi ? 'Bật các trigger đã chọn' : 'Enable selected triggers'}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={editableTriggers.length === 0 || isProcessing}
            onSelect={() => {
              void handleBulkToggle(false);
            }}
            data-testid='bulkDisableTriggers'
          >
            <PauseCircle aria-hidden='true' />
            {isVi ? 'Tắt các trigger đã chọn' : 'Disable selected triggers'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant='destructive'
            disabled={deletableTriggers.length === 0 || isProcessing}
            onSelect={() => {
              setShowDeleteConfirm(true);
            }}
            data-testid='bulkDeleteTriggers'
          >
            <Trash2 aria-hidden='true' />
            {t('common.delete', isVi ? 'Xóa' : 'Delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hộp thoại Đặt lịch chạy chung hàng loạt */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent data-testid='bulkScheduleEditDialog'>
          <DialogHeader>
            <DialogTitle>
              {isVi
                ? `Đặt lịch chạy chung (${editableTriggers.length} trigger)`
                : `Set Shared Schedule (${editableTriggers.length} triggers)`}
            </DialogTitle>
            <DialogDescription>
              {isVi
                ? 'Áp dụng cùng một tần suất, múi giờ và trạng thái hoạt động cho tất cả các trigger đã chọn.'
                : 'Apply the same frequency, timezone, and active state to all selected triggers.'}
            </DialogDescription>
          </DialogHeader>

          <ScheduleConfig
            showPreview={false}
            cron={bulkCron}
            timezone={bulkTimeZone}
            enabled={bulkIsActive}
            onChange={data => {
              setBulkCron(data.cron);
              setBulkTimeZone(data.timezone);
              setBulkIsActive(data.enabled);
            }}
            className='border-border flex flex-col gap-1.5 rounded-md border bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5'
          />

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setShowScheduleDialog(false);
              }}
              disabled={isProcessing}
            >
              {t('common.cancel', isVi ? 'Hủy' : 'Cancel')}
            </Button>
            <Button
              type='button'
              onClick={() => {
                void handleApplyBulkSchedule();
              }}
              disabled={isProcessing}
              data-testid='confirmBulkScheduleBtn'
            >
              {isProcessing
                ? isVi
                  ? 'Đang cập nhật...'
                  : 'Updating...'
                : isVi
                  ? 'Áp dụng lịch chạy chung'
                  : 'Apply Shared Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hộp thoại xác nhận xóa hàng loạt */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isVi
                ? `Xóa ${deletableTriggers.length} trigger đã chọn?`
                : `Delete ${deletableTriggers.length} selected triggers?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isVi
                ? `Bạn sắp xóa đồng loạt ${deletableTriggers.length} lịch kích hoạt tự động. Hành động này không thể hoàn tác.`
                : `You are about to delete ${deletableTriggers.length} scheduled triggers. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              {t('common.cancel', isVi ? 'Hủy' : 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleBulkDelete();
              }}
              disabled={isProcessing}
              className='bg-destructive hover:bg-destructive/90'
              data-testid='confirmBulkDeleteTriggersBtn'
            >
              {isProcessing
                ? isVi
                  ? 'Đang xóa...'
                  : 'Deleting...'
                : t('common.delete', isVi ? 'Xóa' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
