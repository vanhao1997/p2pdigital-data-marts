import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@owox/ui/components/sheet';
import { Badge } from '@owox/ui/components/badge';
import { Button } from '@owox/ui/components/button';
import { Checkbox } from '@owox/ui/components/checkbox';
import { Input } from '@owox/ui/components/input';
import { Label } from '@owox/ui/components/label';
import {
  CalendarClock,
  CheckSquare,
  Database,
  FileBarChart,
  Layers,
  Plug,
  Search,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  isVietnameseLocale,
  normalizeSearchText,
} from '../../../../../shared/utils/field-humanizer';
import { reportService, type ReportResponseDto } from '../../../reports/shared/services';
import {
  DataMartDefinitionType,
  DataMartStatus,
  dataMartService,
  type DataMartListItemResponseDto,
} from '../../../shared';
import { ScheduleConfig } from '../../components/ScheduleConfig/ScheduleConfig';
import { ScheduledTriggerType } from '../../enums';
import type { ProjectScheduledTrigger } from '../../model/scheduled-trigger.model';
import {
  isReportSchedulable,
  syncTriggerGroupWithBackend,
} from '../trigger-group-sync.service';
import type {
  TriggerGroup,
  TriggerGroupDraft,
  TriggerGroupReportSelectionMode,
  TriggerGroupSyncResult,
} from '../trigger-group.model';

export interface TriggerGroupFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  existingGroup?: TriggerGroup | null;
  initialDraft?: Partial<TriggerGroupDraft>;
  existingTriggers?: ProjectScheduledTrigger[];
  onSaved?: (result: TriggerGroupSyncResult) => Promise<void> | void;
}

const DEFAULT_CRON = '0 9 * * *';

function getDefaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function TriggerGroupFormSheet({
  isOpen,
  onClose,
  projectId,
  existingGroup,
  initialDraft,
  existingTriggers = [],
  onSaved,
}: TriggerGroupFormSheetProps) {
  const { t } = useTranslation();
  const isVi = isVietnameseLocale();
  const isEditMode = Boolean(existingGroup);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDataMartIds, setSelectedDataMartIds] = useState<string[]>([]);
  const [selectedTriggerTypes, setSelectedTriggerTypes] = useState<ScheduledTriggerType[]>([
    ScheduledTriggerType.CONNECTOR_RUN,
  ]);
  const [reportSelectionMode, setReportSelectionMode] =
    useState<TriggerGroupReportSelectionMode>('all');
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [cronExpression, setCronExpression] = useState(DEFAULT_CRON);
  const [timeZone, setTimeZone] = useState(getDefaultTimeZone);
  const [isActive, setIsActive] = useState(true);
  const [removeOrphanedTriggers, setRemoveOrphanedTriggers] = useState(true);

  const [dataMarts, setDataMarts] = useState<DataMartListItemResponseDto[]>([]);
  const [reports, setReports] = useState<ReportResponseDto[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dataMartSearch, setDataMartSearch] = useState('');
  const [selectedContextId, setSelectedContextId] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'connector' | 'sql'>('all');

  useEffect(() => {
    if (!isOpen) return;

    if (existingGroup) {
      setName(existingGroup.name);
      setDescription(existingGroup.description ?? '');
      setSelectedDataMartIds(existingGroup.dataMartIds);
      setSelectedTriggerTypes(
        existingGroup.triggerTypes.length > 0
          ? existingGroup.triggerTypes
          : [ScheduledTriggerType.CONNECTOR_RUN]
      );
      setReportSelectionMode(existingGroup.reportSelectionMode);
      setSelectedReportIds(existingGroup.selectedReportIds);
      setCronExpression(existingGroup.cronExpression);
      setTimeZone(existingGroup.timeZone);
      setIsActive(existingGroup.isActive);
      setRemoveOrphanedTriggers(true);
    } else {
      setName(initialDraft?.name ?? '');
      setDescription(initialDraft?.description ?? '');
      setSelectedDataMartIds(initialDraft?.dataMartIds ?? []);
      setSelectedTriggerTypes(
        initialDraft?.triggerTypes && initialDraft.triggerTypes.length > 0
          ? initialDraft.triggerTypes
          : [ScheduledTriggerType.CONNECTOR_RUN, ScheduledTriggerType.DATA_QUALITY_RUN]
      );
      setReportSelectionMode(initialDraft?.reportSelectionMode ?? 'all');
      setSelectedReportIds(initialDraft?.selectedReportIds ?? []);
      setCronExpression(initialDraft?.cronExpression ?? DEFAULT_CRON);
      setTimeZone(initialDraft?.timeZone ?? getDefaultTimeZone());
      setIsActive(initialDraft?.isActive ?? true);
      setRemoveOrphanedTriggers(true);
    }
    setDataMartSearch('');
    setSelectedContextId('all');
    setSourceFilter('all');
  }, [existingGroup, initialDraft, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const fetchResources = async () => {
      setIsLoadingData(true);
      try {
        const [loadedDataMarts, loadedReports] = await Promise.all([
          dataMartService.getDataMarts().catch(() => [] as DataMartListItemResponseDto[]),
          reportService.getReportsByProject().catch(() => [] as ReportResponseDto[]),
        ]);
        if (!cancelled) {
          setDataMarts(loadedDataMarts);
          setReports(loadedReports);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingData(false);
        }
      }
    };

    void fetchResources();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const availableContexts = useMemo(() => {
    const map = new Map<string, string>();
    for (const dm of dataMarts) {
      for (const ctx of dm.contexts ?? []) {
        map.set(ctx.id, ctx.name);
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [dataMarts]);

  const filteredDataMarts = useMemo(() => {
    const normalizedQuery = normalizeSearchText(dataMartSearch);
    return dataMarts.filter(dm => {
      if (selectedContextId !== 'all') {
        const hasCtx = (dm.contexts ?? []).some(ctx => ctx.id === selectedContextId);
        if (!hasCtx) return false;
      }
      if (sourceFilter === 'connector' && dm.definitionType !== DataMartDefinitionType.CONNECTOR) {
        return false;
      }
      if (sourceFilter === 'sql' && dm.definitionType !== DataMartDefinitionType.SQL) {
        return false;
      }
      if (normalizedQuery) {
        const haystack = normalizeSearchText(
          `${dm.title} ${dm.connectorSourceName ?? ''} ${(dm.contexts ?? []).map(c => c.name).join(' ')}`
        );
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [dataMartSearch, dataMarts, selectedContextId, sourceFilter]);

  const publishedFilteredDataMarts = useMemo(
    () => filteredDataMarts.filter(dm => dm.status === DataMartStatus.PUBLISHED),
    [filteredDataMarts]
  );

  const schedulableReportsForSelectedDataMarts = useMemo(() => {
    const selectedSet = new Set(selectedDataMartIds);
    return reports.filter(r => selectedSet.has(r.dataMart.id) && isReportSchedulable(r));
  }, [reports, selectedDataMartIds]);

  const toggleTriggerType = useCallback((type: ScheduledTriggerType) => {
    setSelectedTriggerTypes(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter(item => item !== type);
      }
      return [...prev, type];
    });
  }, []);

  const toggleDataMart = useCallback((id: string) => {
    setSelectedDataMartIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAllVisibleDataMarts = useCallback(() => {
    const visibleIds = publishedFilteredDataMarts.map(dm => dm.id);
    setSelectedDataMartIds(prev => Array.from(new Set([...prev, ...visibleIds])));
  }, [publishedFilteredDataMarts]);

  const handleDeselectAllVisibleDataMarts = useCallback(() => {
    const visibleIdSet = new Set(filteredDataMarts.map(dm => dm.id));
    setSelectedDataMartIds(prev => prev.filter(id => !visibleIdSet.has(id)));
  }, [filteredDataMarts]);

  const toggleReportId = useCallback((reportId: string) => {
    setSelectedReportIds(prev =>
      prev.includes(reportId) ? prev.filter(item => item !== reportId) : [...prev, reportId]
    );
  }, []);

  const canSubmit =
    name.trim().length > 0 &&
    selectedDataMartIds.length > 0 &&
    selectedTriggerTypes.length > 0 &&
    !isSubmitting;

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const result = await syncTriggerGroupWithBackend({
        projectId,
        draft: {
          name: name.trim(),
          description: description.trim() || undefined,
          dataMartIds: selectedDataMartIds,
          triggerTypes: selectedTriggerTypes,
          reportSelectionMode,
          selectedReportIds,
          cronExpression,
          timeZone,
          isActive,
        },
        existingGroup: existingGroup ?? undefined,
        existingTriggers,
        dataMarts,
        reports,
        removeOrphanedTriggers,
      });

      const totalSynced = result.createdCount + result.updatedCount;
      if (totalSynced > 0 || result.removedCount > 0) {
        toast.success(
          isVi
            ? `Đã lưu bộ trigger "${result.group.name}" (Tạo mới: ${result.createdCount}, Cập nhật: ${result.updatedCount})`
            : `Saved trigger group "${result.group.name}" (Created: ${result.createdCount}, Updated: ${result.updatedCount})`
        );
      } else {
        toast.success(
          isVi
            ? `Đã lưu bộ trigger "${result.group.name}"`
            : `Saved trigger group "${result.group.name}"`
        );
      }

      if (result.errors.length > 0) {
        toast.warning(
          isVi
            ? `Một số Data Mart chưa đủ điều kiện tạo trigger: ${result.errors.slice(0, 2).join('; ')}`
            : `Some Data Marts could not be synced: ${result.errors.slice(0, 2).join('; ')}`
        );
      }

      await onSaved?.(result);
      onClose();
    } catch (error) {
      console.error('Error saving trigger group:', error);
      toast.error(
        isVi
          ? 'Không thể lưu bộ trigger nhóm. Vui lòng thử lại.'
          : 'Failed to save trigger group. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerTypeOptions = [
    {
      type: ScheduledTriggerType.CONNECTOR_RUN,
      icon: Plug,
      title: isVi
        ? 'Chạy trình kết nối (Connector Run)'
        : t('triggerForm.connectorRun', 'Connector Run'),
      desc: isVi
        ? 'Tự động thu thập dữ liệu từ nguồn cho các Data Mart loại Connector trong nhóm'
        : 'Automatically fetch source data for Connector Data Marts in the group',
    },
    {
      type: ScheduledTriggerType.DATA_QUALITY_RUN,
      icon: ShieldCheck,
      title: isVi
        ? 'Kiểm tra chất lượng dữ liệu (Data Quality Run)'
        : t('triggerForm.qualityRun', 'Data Quality Run'),
      desc: isVi
        ? 'Tự động chạy bộ quy tắc kiểm tra chất lượng dữ liệu cho các Data Mart trong nhóm'
        : 'Automatically run enabled Data Quality checks for Data Marts in the group',
    },
    {
      type: ScheduledTriggerType.REPORT_RUN,
      icon: FileBarChart,
      title: isVi ? 'Chạy báo cáo (Report Run)' : t('triggerForm.reportRun', 'Report Run'),
      desc: isVi
        ? 'Tự động làm mới và gửi các báo cáo thuộc nhóm Data Mart đã chọn'
        : 'Automatically refresh and deliver reports belonging to the selected Data Marts',
    },
  ];

  return (
    <Sheet
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        data-testid='triggerGroupFormSheet'
        className='flex w-full flex-col overflow-y-auto sm:max-w-xl'
      >
        <SheetHeader>
          <SheetTitle className='flex items-center gap-2'>
            <Layers className='text-primary h-5 w-5' />
            {isEditMode
              ? isVi
                ? 'Chỉnh sửa Bộ Trigger nhóm'
                : 'Edit Trigger Group'
              : isVi
                ? 'Tạo Bộ Trigger chung cho nhóm Data Mart'
                : 'Create Trigger Group for Data Marts'}
          </SheetTitle>
          <SheetDescription>
            {isVi
              ? 'Thiết lập và đồng bộ lịch chạy tự động chung cho nhiều Data Mart cùng lúc thay vì cấu hình đơn lẻ từng Data Mart.'
              : 'Configure and synchronize a shared schedule across a group of Data Marts at once instead of managing each Data Mart individually.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={e => void handleSubmit(e)} className='mt-4 flex flex-1 flex-col gap-5'>
          {/* 1. Tên & Mô tả Bộ Trigger */}
          <div className='space-y-3'>
            <div className='space-y-1.5'>
              <Label htmlFor='trigger-group-name'>
                {isVi ? 'Tên Bộ Trigger nhóm *' : 'Trigger Group Name *'}
              </Label>
              <Input
                id='trigger-group-name'
                data-testid='triggerGroupNameInput'
                value={name}
                onChange={e => {
                  setName(e.target.value);
                }}
                placeholder={
                  isVi
                    ? 'VD: Đồng bộ Quảng cáo & Kiểm tra chất lượng 7h sáng'
                    : 'e.g. Daily Morning Ads Sync & Quality Check'
                }
                required
              />
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='trigger-group-description'>
                {isVi ? 'Mô tả (tùy chọn)' : 'Description (optional)'}
              </Label>
              <Input
                id='trigger-group-description'
                data-testid='triggerGroupDescriptionInput'
                value={description}
                onChange={e => {
                  setDescription(e.target.value);
                }}
                placeholder={
                  isVi
                    ? 'VD: Áp dụng cho toàn bộ nhóm Data Mart Marketing'
                    : 'e.g. Shared schedule for all Marketing Data Marts'
                }
              />
            </div>
          </div>

          {/* 2. Chọn các Loại tác vụ kích hoạt */}
          <div className='space-y-2'>
            <Label>
              {isVi
                ? 'Loại tác vụ kích hoạt trong bộ (chọn 1 hoặc nhiều) *'
                : 'Trigger Types in Group (select one or more) *'}
            </Label>
            <div className='grid grid-cols-1 gap-2'>
              {triggerTypeOptions.map(option => {
                const Icon = option.icon;
                const checked = selectedTriggerTypes.includes(option.type);
                return (
                  <label
                    key={option.type}
                    data-testid={`triggerGroupType-${option.type}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                      checked
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => {
                        toggleTriggerType(option.type);
                      }}
                      className='mt-0.5'
                    />
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-1.5 text-sm font-medium'>
                        <Icon className='text-muted-foreground h-4 w-4 shrink-0' />
                        <span>{option.title}</span>
                      </div>
                      <p className='text-muted-foreground mt-0.5 text-xs'>{option.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Chọn Nhóm Data Mart */}
          <div className='space-y-2.5'>
            <div className='flex items-center justify-between gap-2'>
              <Label className='flex items-center gap-1.5'>
                <Database className='h-4 w-4' />
                {isVi ? 'Nhóm Data Mart áp dụng *' : 'Target Data Marts *'}
                <Badge variant='secondary' className='ml-1'>
                  {selectedDataMartIds.length}
                </Badge>
              </Label>
              <div className='flex items-center gap-1.5'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-7 px-2 text-xs'
                  onClick={handleSelectAllVisibleDataMarts}
                  disabled={publishedFilteredDataMarts.length === 0}
                  data-testid='triggerGroupSelectAllDataMarts'
                >
                  <CheckSquare className='mr-1 h-3.5 w-3.5' />
                  {isVi ? 'Chọn tất cả' : 'Select all'}
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-7 px-2 text-xs'
                  onClick={handleDeselectAllVisibleDataMarts}
                  disabled={selectedDataMartIds.length === 0}
                >
                  <Square className='mr-1 h-3.5 w-3.5' />
                  {isVi ? 'Bỏ chọn' : 'Clear'}
                </Button>
              </div>
            </div>

            {/* Thanh tìm kiếm & lọc nhanh theo Context / Loại */}
            <div className='flex flex-col gap-2'>
              <div className='relative'>
                <Search className='text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 h-4 w-4' />
                <Input
                  value={dataMartSearch}
                  onChange={e => {
                    setDataMartSearch(e.target.value);
                  }}
                  placeholder={
                    isVi
                      ? 'Tìm kiếm Data Mart theo tên hoặc nguồn...'
                      : 'Search Data Marts by title or source...'
                  }
                  className='h-9 pl-8 text-sm'
                  data-testid='triggerGroupDataMartSearch'
                />
              </div>

              <div className='flex flex-wrap items-center gap-1.5'>
                <button
                  type='button'
                  onClick={() => {
                    setSourceFilter('all');
                  }}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    sourceFilter === 'all'
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {isVi ? 'Tất cả loại' : 'All types'}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setSourceFilter('connector');
                  }}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    sourceFilter === 'connector'
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {isVi ? 'Chỉ Connector' : 'Connectors only'}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setSourceFilter('sql');
                  }}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    sourceFilter === 'sql'
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {isVi ? 'Chỉ SQL' : 'SQL only'}
                </button>

                {availableContexts.map(ctx => (
                  <button
                    key={ctx.id}
                    type='button'
                    onClick={() => {
                      setSelectedContextId(prev => (prev === ctx.id ? 'all' : ctx.id));
                    }}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      selectedContextId === ctx.id
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    #{ctx.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Danh sách Data Mart */}
            <div className='border-border max-h-52 divide-y overflow-y-auto rounded-md border'>
              {isLoadingData ? (
                <div className='text-muted-foreground p-4 text-center text-xs'>
                  {isVi ? 'Đang tải danh sách Data Mart...' : 'Loading Data Marts...'}
                </div>
              ) : filteredDataMarts.length === 0 ? (
                <div className='text-muted-foreground p-4 text-center text-xs'>
                  {isVi
                    ? 'Không tìm thấy Data Mart phù hợp.'
                    : 'No matching Data Marts found.'}
                </div>
              ) : (
                filteredDataMarts.map(dm => {
                  const isPublished = dm.status === DataMartStatus.PUBLISHED;
                  const checked = selectedDataMartIds.includes(dm.id);
                  return (
                    <label
                      key={dm.id}
                      data-testid={`triggerGroupDataMartItem-${dm.id}`}
                      className={`flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors ${
                        !isPublished
                          ? 'cursor-not-allowed opacity-60'
                          : ' hover:bg-muted/40 cursor-pointer'
                      }`}
                    >
                      <div className='flex min-w-0 items-center gap-2.5'>
                        <Checkbox
                          checked={checked}
                          disabled={!isPublished}
                          onCheckedChange={() => {
                            if (isPublished) toggleDataMart(dm.id);
                          }}
                        />
                        <div className='min-w-0'>
                          <div className='truncate font-medium'>{dm.title}</div>
                          <div className='text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px]'>
                            <span>
                              {dm.definitionType === DataMartDefinitionType.CONNECTOR
                                ? isVi
                                  ? `Trình kết nối${dm.connectorSourceName ? ` (${dm.connectorSourceName})` : ''}`
                                  : `Connector${dm.connectorSourceName ? ` (${dm.connectorSourceName})` : ''}`
                                : 'SQL'}
                            </span>
                            <span>•</span>
                            <span>
                              {isVi
                                ? `${dm.reportsCount} báo cáo`
                                : `${dm.reportsCount} reports`}
                            </span>
                            {(dm.contexts ?? []).map(ctx => (
                              <Badge
                                key={ctx.id}
                                variant='outline'
                                className='h-4 px-1.5 py-0 text-[10px]'
                              >
                                {ctx.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={isPublished ? 'secondary' : 'outline'}
                        className='shrink-0 text-[10px]'
                      >
                        {isPublished
                          ? isVi
                            ? 'Đã xuất bản'
                            : 'Published'
                          : isVi
                            ? 'Bản nháp'
                            : 'Draft'}
                      </Badge>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Phạm vi Báo cáo (khi chọn REPORT_RUN) */}
          {selectedTriggerTypes.includes(ScheduledTriggerType.REPORT_RUN) && (
            <div className='border-border bg-muted/20 space-y-2.5 rounded-md border p-3'>
              <div className='flex items-center justify-between'>
                <Label className='text-xs font-semibold'>
                  {isVi
                    ? `Phạm vi Báo cáo (${schedulableReportsForSelectedDataMarts.length} báo cáo khả dụng)`
                    : `Report Scope (${schedulableReportsForSelectedDataMarts.length} schedulable reports)`}
                </Label>
                <div className='flex items-center gap-2 text-xs'>
                  <button
                    type='button'
                    onClick={() => {
                      setReportSelectionMode('all');
                    }}
                    className={`rounded px-2 py-0.5 ${
                      reportSelectionMode === 'all'
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {isVi ? 'Tất cả báo cáo của nhóm' : 'All reports in group'}
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setReportSelectionMode('selected');
                    }}
                    className={`rounded px-2 py-0.5 ${
                      reportSelectionMode === 'selected'
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {isVi ? 'Chọn cụ thể' : 'Select specific'}
                  </button>
                </div>
              </div>

              {reportSelectionMode === 'selected' && (
                <div className='border-border bg-background max-h-36 divide-y overflow-y-auto rounded border'>
                  {schedulableReportsForSelectedDataMarts.length === 0 ? (
                    <div className='text-muted-foreground p-3 text-center text-xs'>
                      {isVi
                        ? 'Các Data Mart đã chọn chưa có báo cáo có thể lập lịch.'
                        : 'No schedulable reports in the selected Data Marts.'}
                    </div>
                  ) : (
                    schedulableReportsForSelectedDataMarts.map(report => (
                      <label
                        key={report.id}
                        className='hover:bg-muted/40 flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs'
                      >
                        <div className='flex min-w-0 items-center gap-2'>
                          <Checkbox
                            checked={selectedReportIds.includes(report.id)}
                            onCheckedChange={() => {
                              toggleReportId(report.id);
                            }}
                          />
                          <span className='truncate font-medium'>{report.title}</span>
                        </div>
                        <span className='text-muted-foreground shrink-0 text-[11px]'>
                          {report.dataMart.title}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5. Cấu hình Lịch chạy chung */}
          <div className='space-y-1.5'>
            <Label className='flex items-center gap-1.5'>
              <CalendarClock className='h-4 w-4' />
              {isVi ? 'Lịch chạy chung cho toàn bộ nhóm' : 'Shared Schedule for Group'}
            </Label>
            <ScheduleConfig
              showPreview={false}
              cron={cronExpression}
              timezone={timeZone}
              enabled={isActive}
              onChange={data => {
                setCronExpression(data.cron);
                setTimeZone(data.timezone);
                setIsActive(data.enabled);
              }}
              className='border-border flex flex-col gap-1.5 rounded-md border bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5'
            />
          </div>

          {isEditMode && (
            <label className='text-muted-foreground flex cursor-pointer items-center gap-2 text-xs'>
              <Checkbox
                checked={removeOrphanedTriggers}
                onCheckedChange={checked => {
                  setRemoveOrphanedTriggers(Boolean(checked));
                }}
              />
              <span>
                {isVi
                  ? 'Tự động xóa các trigger thuộc Data Mart hoặc loại tác vụ đã gỡ khỏi nhóm'
                  : 'Automatically delete triggers for Data Marts or types removed from this group'}
              </span>
            </label>
          )}

          <div className='mt-auto flex flex-col gap-2 pt-3'>
            <Button
              type='submit'
              disabled={!canSubmit}
              data-testid='triggerGroupSubmitButton'
              className='w-full'
            >
              {isSubmitting
                ? isVi
                  ? 'Đang đồng bộ Bộ Trigger...'
                  : 'Syncing Trigger Group...'
                : isEditMode
                  ? isVi
                    ? 'Lưu & Đồng bộ Bộ Trigger'
                    : 'Save & Sync Trigger Group'
                  : isVi
                    ? `Tạo & Đồng bộ cho ${selectedDataMartIds.length} Data Mart`
                    : `Create & Sync for ${selectedDataMartIds.length} Data Marts`}
            </Button>
            <Button type='button' variant='outline' onClick={onClose} className='w-full'>
              {t('common.cancel', isVi ? 'Hủy' : 'Cancel')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
