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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@owox/ui/components/dropdown-menu';
import {
  ChevronDown,
  CircleCheckBig,
  Download,
  FileImage,
  FileJson,
  FileText,
  History,
  Image as ImageIcon,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { DataStorageType } from '../../../../data-storage';
import { DataMartStatus } from '../../enums';
import { RunDataQualityBatchDialog } from '../RunDataQualityBatchDialog';

export interface DataMartBulkActionTarget {
  id: string;
  status: DataMartStatus;
  storageType?: DataStorageType;
}

export type DataMartCanvasExportFormat = 'svg' | 'png' | 'json' | 'okf';

const EXPORT_ITEMS: {
  format: DataMartCanvasExportFormat;
  labelKey: string;
  defaultLabel: string;
  icon: typeof Download;
}[] = [
  {
    format: 'svg',
    labelKey: 'dataMartBulkActions.imageSvg',
    defaultLabel: 'Ảnh (SVG)',
    icon: ImageIcon,
  },
  {
    format: 'png',
    labelKey: 'dataMartBulkActions.imagePng',
    defaultLabel: 'Ảnh (PNG)',
    icon: FileImage,
  },
  { format: 'json', labelKey: 'dataMartBulkActions.json', defaultLabel: 'JSON', icon: FileJson },
  {
    format: 'okf',
    labelKey: 'dataMartBulkActions.okf',
    defaultLabel: 'OKF (Markdown)',
    icon: FileText,
  },
];

interface DataMartBulkActionsProps {
  dataMarts: DataMartBulkActionTarget[];
  projectId: string;
  deleteDataMart: (id: string) => Promise<void>;
  publishDataMart: (id: string) => Promise<void>;
  onCompleted: () => void | Promise<void>;
  onClearDataMarts?: () => void;
  targetScope?: 'selection' | 'canvas';
  /**
   * When provided, adds a "Data Last Updated" item that measures, for every targeted Data Mart,
   * when its source tables last changed in the storage. Free of consumption — safe to run on
   * the whole set without a confirmation dialog.
   */
  onCheckDataLastUpdated?: () => void;
  isCheckingDataLastUpdated?: boolean;
  /**
   * When provided, adds an "Export" submenu with the canvas export formats.
   * Only the canvas surface passes it — the list page has no model to export.
   */
  onExport?: (format: DataMartCanvasExportFormat) => void;
}

export function DataMartBulkActions({
  dataMarts,
  projectId,
  deleteDataMart,
  publishDataMart,
  onCompleted,
  onClearDataMarts,
  targetScope = 'selection',
  onCheckDataLastUpdated,
  isCheckingDataLastUpdated = false,
  onExport,
}: DataMartBulkActionsProps) {
  const { t } = useTranslation();
  const [actionDataMarts, setActionDataMarts] = useState<DataMartBulkActionTarget[]>([]);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showRunQuality, setShowRunQuality] = useState(false);

  const draftDataMarts = useMemo(
    () => actionDataMarts.filter(dataMart => dataMart.status === DataMartStatus.DRAFT),
    [actionDataMarts]
  );
  const hasDraftDataMarts = dataMarts.some(dataMart => dataMart.status === DataMartStatus.DRAFT);

  if (dataMarts.length === 0) return null;

  const snapshotDataMarts = () => {
    const snapshot = dataMarts.map(dataMart => ({ ...dataMart }));
    setActionDataMarts(snapshot);
    return snapshot;
  };

  const handleBatchDelete = async () => {
    if (actionDataMarts.length === 0 || isDeleting) return;

    setIsDeleting(true);
    let successCount = 0;

    for (const dataMart of actionDataMarts) {
      try {
        await deleteDataMart(dataMart.id);
        successCount += 1;
      } catch (error) {
        console.error(`Error deleting data mart ${dataMart.id}:`, error);
      }
    }

    if (successCount > 0) {
      toast.success(
        t('dataMartBulkActions.deleteSuccess', 'Đã xóa {{count}} Data Mart', {
          count: successCount,
        })
      );
    }

    const failedCount = actionDataMarts.length - successCount;
    if (failedCount > 0) {
      toast.error(
        t(
          'dataMartBulkActions.deleteFailed',
          'Không thể xóa {{count}} Data Mart. Vui lòng thử lại.',
          { count: failedCount }
        )
      );
    }

    await Promise.allSettled([Promise.resolve().then(onCompleted)]);
    onClearDataMarts?.();
    setIsDeleting(false);
    setShowDeleteConfirmation(false);
  };

  const handleBatchPublish = async () => {
    if (draftDataMarts.length === 0 || isPublishing) return;

    setIsPublishing(true);
    let successCount = 0;

    for (const dataMart of draftDataMarts) {
      try {
        await publishDataMart(dataMart.id);
        successCount += 1;
      } catch (error) {
        console.error(`Error publishing data mart ${dataMart.id}:`, error);
      }
    }

    if (successCount > 0) {
      toast.success(
        t('dataMartBulkActions.publishSuccess', 'Đã xuất bản {{count}} Data Mart', {
          count: successCount,
        }),
        { duration: 10000 }
      );
    }

    const failedCount = draftDataMarts.length - successCount;
    if (failedCount > 0) {
      toast.error(
        t(
          'dataMartBulkActions.publishFailed',
          'Không thể xuất bản {{count}} Data Mart. Vui lòng kiểm tra riêng.',
          { count: failedCount }
        ),
        { duration: 10000 }
      );
    }

    await Promise.allSettled([Promise.resolve().then(onCompleted)]);
    onClearDataMarts?.();
    setIsPublishing(false);
    setShowPublishConfirmation(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            title={
              targetScope === 'canvas'
                ? t(
                    'dataMartBulkActions.canvasActionsTitle',
                    'Thao tác cho toàn bộ Data Mart đang hiển thị theo bộ lọc canvas'
                  )
                : t(
                    'dataMartBulkActions.selectionActionsTitle',
                    'Thao tác hàng loạt cho Data Mart đã chọn'
                  )
            }
          >
            <span>{t('dataMartBulkActions.actions', 'Thao tác')}</span>
            <Badge
              variant='secondary'
              className='bg-muted text-muted-foreground rounded-full border-transparent px-1.5 py-0 text-xs'
            >
              {dataMarts.length}
            </Badge>
            <ChevronDown className='h-4 w-4' aria-hidden='true' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start'>
          <DropdownMenuItem
            disabled={!hasDraftDataMarts || isPublishing}
            onSelect={() => {
              snapshotDataMarts();
              setShowPublishConfirmation(true);
            }}
          >
            <CircleCheckBig aria-hidden='true' />
            {t('dataMartBulkActions.publish', 'Xuất bản')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              snapshotDataMarts();
              setShowRunQuality(true);
            }}
            data-testid='run-selected-data-quality'
          >
            <ShieldCheck aria-hidden='true' />
            {t('dataMartBulkActions.checkQuality', 'Kiểm tra chất lượng')}
          </DropdownMenuItem>
          {onCheckDataLastUpdated && (
            <DropdownMenuItem
              disabled={isCheckingDataLastUpdated}
              onSelect={onCheckDataLastUpdated}
              data-testid='check-data-last-updated'
            >
              <History aria-hidden='true' />
              {isCheckingDataLastUpdated
                ? t(
                    'dataMartBulkActions.checkingDataLastUpdated',
                    'Đang kiểm tra dữ liệu cập nhật lần cuối…'
                  )
                : t(
                    'dataMartBulkActions.checkDataLastUpdated',
                    'Kiểm tra dữ liệu cập nhật lần cuối'
                  )}
            </DropdownMenuItem>
          )}
          {onExport && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-testid='export-canvas' className='gap-2'>
                <Download className='text-muted-foreground size-4 shrink-0' aria-hidden='true' />
                {t('dataMartBulkActions.export', 'Xuất')}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {EXPORT_ITEMS.map(item => (
                    <DropdownMenuItem
                      key={item.format}
                      data-testid={`export-canvas-${item.format}`}
                      onSelect={() => {
                        onExport(item.format);
                      }}
                    >
                      <item.icon aria-hidden='true' />
                      {t(item.labelKey, item.defaultLabel)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant='destructive'
            disabled={isDeleting}
            onSelect={() => {
              snapshotDataMarts();
              setShowDeleteConfirmation(true);
            }}
          >
            <Trash2 aria-hidden='true' />
            {t('common.delete', 'Delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showRunQuality && (
        <RunDataQualityBatchDialog
          open
          onOpenChange={next => {
            setShowRunQuality(next);
            if (!next) setActionDataMarts([]);
          }}
          dataMarts={actionDataMarts}
          projectId={projectId}
          onCompleted={onCompleted}
          targetScope={targetScope}
        />
      )}

      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('dataMartBulkActions.deleteConfirmTitle', 'Bạn chắc chắn muốn xóa?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className='mt-2 block space-y-2'>
                <span className='block'>
                  {targetScope === 'canvas'
                    ? t(
                        'dataMartBulkActions.deleteCanvasDescription',
                        'Bạn sắp xóa {{count}} Data Mart đang hiển thị theo bộ lọc canvas hiện tại.',
                        { count: actionDataMarts.length }
                      )
                    : t(
                        'dataMartBulkActions.deleteSelectionDescription',
                        'Bạn sắp xóa {{count}} Data Mart đã chọn.',
                        { count: actionDataMarts.length }
                      )}
                </span>
                {actionDataMarts.some(
                  dataMart => dataMart.storageType === DataStorageType.LEGACY_GOOGLE_BIGQUERY
                ) && (
                  <span className='text-destructive block'>
                    {t(
                      'dataMartBulkActions.legacyBigQueryWarning',
                      'Một số Data Mart này cũng sẽ không còn khả dụng trong tiện ích Google Sheets vì đang dùng kho BigQuery cũ.'
                    )}
                  </span>
                )}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleBatchDelete();
              }}
              disabled={isDeleting}
              className='bg-destructive hover:bg-destructive/90'
            >
              {isDeleting
                ? t('dataMartBulkActions.deleting', 'Đang xóa...')
                : t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showPublishConfirmation} onOpenChange={setShowPublishConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('dataMartBulkActions.publishConfirmTitle', 'Xuất bản Data Mart nháp?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {targetScope === 'canvas'
                ? t(
                    'dataMartBulkActions.publishCanvasDescription',
                    'Bạn sắp xuất bản {{count}} Data Mart nháp đang hiển thị theo bộ lọc canvas hiện tại.',
                    { count: draftDataMarts.length }
                  )
                : t(
                    'dataMartBulkActions.publishSelectionDescription',
                    'Bạn sắp xuất bản {{count}} Data Mart nháp đã chọn.',
                    { count: draftDataMarts.length }
                  )}
              <br />
              {t(
                'dataMartBulkActions.publishDescription',
                'Lược đồ sẽ được cập nhật và các Data Mart sẽ chuyển sang trạng thái Đã xuất bản.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>
              {t('common.cancel', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleBatchPublish();
              }}
              disabled={isPublishing}
            >
              {isPublishing
                ? t('dataMartBulkActions.publishing', 'Đang xuất bản...')
                : t('dataMartBulkActions.publish', 'Xuất bản')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
