import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@owox/ui/components/sheet';
import { AppForm, FormActions, FormLayout } from '@owox/ui/components/form';
import { Badge } from '@owox/ui/components/badge';
import { Button } from '@owox/ui/components/button';
import { Checkbox } from '@owox/ui/components/checkbox';
import { Input } from '@owox/ui/components/input';
import { Label } from '@owox/ui/components/label';
import {
  CalendarClock,
  CheckSquare,
  Code2,
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
        ? 'Chạy trình kết nối'
        : t('triggerForm.connectorRun', 'Connector Run'),
      badge: 'Connector Run',
      desc: isVi
        ? 'Tự động thu thập dữ liệu từ nguồn cho các Data Mart loại Connector trong nhóm'
        : 'Automatically fetch source data for Connector Data Marts in the group',
    },
    {
      type: ScheduledTriggerType.DATA_QUALITY_RUN,
      icon: ShieldCheck,
      title: isVi
        ? 'Kiểm tra chất lượng dữ liệu'
        : t('triggerForm.qualityRun', 'Data Quality Run'),
      badge: 'Data Quality',
      desc: isVi
        ? 'Tự động chạy bộ quy tắc kiểm tra chất lượng dữ liệu cho các Data Mart trong nhóm'
        : 'Automatically run enabled Data Quality checks for Data Marts in the group',
    },
    {
      type: ScheduledTriggerType.REPORT_RUN,
      icon: FileBarChart,
      title: isVi ? 'Chạy báo cáo' : t('triggerForm.reportRun', 'Report Run'),
      badge: 'Report Run',
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
        className='sm:max-w-[640px] sm:min-w-[600px]'
      >
        <SheetHeader className='bg-background border-b px-5 py-4'>
          <SheetTitle className='flex items-center gap-2.5 text-base'>
            <span className='bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md'>
              <Layers className='h-4 w-4' />
            </span>
            <span>
              {isEditMode
                ? isVi
                  ? 'Chỉnh sửa Bộ Trigger nhóm'
                  : 'Edit Trigger Group'
                : isVi
                  ? 'Tạo Bộ Trigger chung cho nhóm Data Mart'
                  : 'Create Trigger Group for Data Marts'}
            </span>
          </SheetTitle>
          <SheetDescription className='text-xs leading-relaxed'>
            {isVi
              ? 'Thiết lập và đồng bộ lịch chạy tự động chung cho nhiều Data Mart cùng lúc thay vì cấu hình đơn lẻ từng Data Mart.'
              : 'Configure and synchronize a shared schedule across a group of Data Marts at once instead of managing each Data Mart individually.'}
          </SheetDescription>
        </SheetHeader>

        <AppForm onSubmit={e => void handleSubmit(e)}>
          <FormLayout className='gap-3.5'>
            {/* 1. Thông tin chung */}
            <div className='border-border/80 bg-card space-y-3 rounded-lg border p-4 shadow-2xs'>
              <div className='space-y-1.5'>
                <Label htmlFor='trigger-group-name' className='text-xs font-semibold'>
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
                  className='h-9 text-sm'
                  required
                />
              </div>

              <div className='space-y-1.5'>
                <Label
                  htmlFor='trigger-group-description'
                  className='text-muted-foreground text-xs font-medium'
                >
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
                  className='h-9 text-sm'
                />
              </div>
            </div>

            {/* 2. Chọn các Loại tác vụ kích hoạt */}
            <div className='border-border/80 bg-card space-y-3 rounded-lg border p-4 shadow-2xs'>
              <div className='flex items-center justify-between gap-2'>
                <Label className='text-xs font-semibold'>
                  {isVi
                    ? 'Loại tác vụ kích hoạt trong bộ *'
                    : 'Trigger Types in Group *'}
                </Label>
                <span className='text-muted-foreground text-[11px]'>
                  {isVi
                    ? `Đã chọn ${selectedTriggerTypes.length}/3 tác vụ`
                    : `${selectedTriggerTypes.length}/3 selected`}
                </span>
              </div>

              <div className='grid grid-cols-1 gap-2'>
                {triggerTypeOptions.map(option => {
                  const Icon = option.icon;
                  const checked = selectedTriggerTypes.includes(option.type);
                  return (
                    <label
                      key={option.type}
                      data-testid={`triggerGroupType-${option.type}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                        checked
                          ? 'border-primary/60 bg-primary/[0.04] ring-primary/15 ring-1'
                          : 'border-border/70 bg-background hover:bg-muted/40'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => {
                          toggleTriggerType(option.type);
                        }}
                        className='mt-1'
                      />
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                          checked
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Icon className='h-4 w-4' />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-wrap items-center gap-1.5'>
                          <span className='text-sm font-medium'>{option.title}</span>
                          {isVi && (
                            <Badge
                              variant='outline'
                              className='text-muted-foreground h-4 px-1.5 py-0 text-[10px] font-normal'
                            >
                              {option.badge}
                            </Badge>
                          )}
                        </div>
                        <p className='text-muted-foreground mt-0.5 text-xs leading-snug'>
                          {option.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Phạm vi Báo cáo (khi chọn REPORT_RUN) */}
              {selectedTriggerTypes.includes(ScheduledTriggerType.REPORT_RUN) && (
                <div className='border-border/70 bg-muted/30 space-y-2.5 rounded-lg border p-3'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <Label className='text-xs font-medium'>
                      {isVi
                        ? `Phạm vi Báo cáo (${schedulableReportsForSelectedDataMarts.length} khả dụng)`
                        : `Report Scope (${schedulableReportsForSelectedDataMarts.length} available)`}
                    </Label>
                    <div className='bg-muted inline-flex items-center rounded-md p-0.5 text-xs'>
                      <button
                        type='button'
                        onClick={() => {
                          setReportSelectionMode('all');
                        }}
                        className={`rounded px-2.5 py-1 transition-all ${
                          reportSelectionMode === 'all'
                            ? 'bg-background text-foreground font-medium shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isVi ? 'Tất cả báo cáo' : 'All reports'}
                      </button>
                      <button
                        type='button'
                        onClick={() => {
                          setReportSelectionMode('selected');
                        }}
                        className={`rounded px-2.5 py-1 transition-all ${
                          reportSelectionMode === 'selected'
                            ? 'bg-background text-foreground font-medium shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isVi ? 'Chọn cụ thể' : 'Select specific'}
                      </button>
                    </div>
                  </div>

                  {reportSelectionMode === 'selected' && (
                    <div className='border-border bg-background max-h-36 divide-y overflow-y-auto rounded-md border'>
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
                            className='hover:bg-muted/40 flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs'
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
            </div>

            {/* 3. Chọn Nhóm Data Mart */}
            <div className='border-border/80 bg-card space-y-3 rounded-lg border p-4 shadow-2xs'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <Label className='flex items-center gap-1.5 text-xs font-semibold'>
                  <Database className='text-primary h-3.5 w-3.5' />
                  <span>{isVi ? 'Nhóm Data Mart áp dụng *' : 'Target Data Marts *'}</span>
                  <Badge variant='secondary' className='ml-0.5 h-5 px-1.5 text-[11px]'>
                    {selectedDataMartIds.length}
                  </Badge>
                </Label>
                <div className='flex items-center gap-1'>
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
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                  <div className='relative flex-1'>
                    <Search className='text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5' />
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
                      className='h-8 pl-8 text-xs'
                      data-testid='triggerGroupDataMartSearch'
                    />
                  </div>

                  <div className='bg-muted inline-flex shrink-0 items-center rounded-md p-0.5 text-xs'>
                    <button
                      type='button'
                      onClick={() => {
                        setSourceFilter('all');
                      }}
                      className={`rounded px-2.5 py-1 transition-all ${
                        sourceFilter === 'all'
                          ? 'bg-background text-foreground font-medium shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isVi ? 'Tất cả' : 'All'}
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        setSourceFilter('connector');
                      }}
                      className={`rounded px-2.5 py-1 transition-all ${
                        sourceFilter === 'connector'
                          ? 'bg-background text-foreground font-medium shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {isVi ? 'Connector' : 'Connector'}
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        setSourceFilter('sql');
                      }}
                      className={`rounded px-2.5 py-1 transition-all ${
                        sourceFilter === 'sql'
                          ? 'bg-background text-foreground font-medium shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      SQL
                    </button>
                  </div>
                </div>

                {availableContexts.length > 0 && (
                  <div className='flex flex-wrap items-center gap-1.5'>
                    {availableContexts.map(ctx => (
                      <button
                        key={ctx.id}
                        type='button'
                        onClick={() => {
                          setSelectedContextId(prev => (prev === ctx.id ? 'all' : ctx.id));
                        }}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                          selectedContextId === ctx.id
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        #{ctx.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Danh sách Data Mart */}
              <div className='border-border bg-background max-h-52 divide-y overflow-y-auto rounded-lg border'>
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
                    const isConnector = dm.definitionType === DataMartDefinitionType.CONNECTOR;
                    return (
                      <label
                        key={dm.id}
                        data-testid={`triggerGroupDataMartItem-${dm.id}`}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors ${
                          !isPublished
                            ? 'cursor-not-allowed opacity-60'
                            : checked
                              ? 'bg-primary/[0.04] hover:bg-primary/[0.06] cursor-pointer'
                              : 'hover:bg-muted/40 cursor-pointer'
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
                          <div className='bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md'>
                            {isConnector ? (
                              <Plug className='h-3.5 w-3.5' />
                            ) : (
                              <Code2 className='h-3.5 w-3.5' />
                            )}
                          </div>
                          <div className='min-w-0'>
                            <div className='truncate text-xs font-medium sm:text-sm'>{dm.title}</div>
                            <div className='text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px]'>
                              <span>
                                {isConnector
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
                          className={`shrink-0 text-[10px] ${
                            isPublished
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : ''
                          }`}
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

            {/* 4. Cấu hình Lịch chạy chung */}
            <div className='border-border/80 bg-card space-y-3 rounded-lg border p-4 shadow-2xs'>
              <Label className='flex items-center gap-1.5 text-xs font-semibold'>
                <CalendarClock className='text-primary h-3.5 w-3.5' />
                <span>
                  {isVi ? 'Lịch chạy chung cho toàn bộ nhóm' : 'Shared Schedule for Group'}
                </span>
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
                className='flex flex-col gap-1.5'
              />
            </div>

            {isEditMode && (
              <label className='border-border/70 bg-card text-muted-foreground flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs'>
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
          </FormLayout>

          <FormActions className='bg-background flex-row-reverse items-center justify-start gap-2 border-t px-5 py-3.5'>
            <Button
              type='submit'
              disabled={!canSubmit}
              data-testid='triggerGroupSubmitButton'
              className='flex-1 sm:flex-initial'
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
                    ? `Tạo & Đồng bộ (${selectedDataMartIds.length} Data Mart)`
                    : `Create & Sync (${selectedDataMartIds.length} Data Marts)`}
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              className='flex-1 sm:flex-initial'
            >
              {t('common.cancel', isVi ? 'Hủy' : 'Cancel')}
            </Button>
          </FormActions>
        </AppForm>
      </SheetContent>
    </Sheet>
  );
}
