import { useState } from 'react';
import { Link } from 'react-router';
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
import { Checkbox } from '@owox/ui/components/checkbox';
import { Switch } from '@owox/ui/components/switch';
import RelativeTime from '@owox/ui/components/common/relative-time';
import {
  CalendarClock,
  Database,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { isVietnameseLocale } from '../../../../../shared/utils/field-humanizer';
import { useProjectRoute } from '../../../../../shared/hooks';
import { ScheduleDisplay } from '../../components/ScheduleDisplay/ScheduleDisplay';
import type { ProjectScheduledTrigger } from '../../model/scheduled-trigger.model';
import { getScheduledTriggerTypeLabel } from '../../utils/scheduled-trigger-labels';
import {
  deleteTriggerGroupOnBackend,
  syncTriggerGroupWithBackend,
  toggleTriggerGroupActiveOnBackend,
} from '../trigger-group-sync.service';
import type {
  DiscoveredTriggerCluster,
  TriggerGroup,
  TriggerGroupDraft,
} from '../trigger-group.model';

export interface TriggerGroupsSectionProps {
  projectId: string;
  groups: TriggerGroup[];
  discoveredClusters: DiscoveredTriggerCluster[];
  triggers: ProjectScheduledTrigger[];
  dataMartTitlesById: Map<string, string>;
  activeGroupFilterId: string | null;
  onSelectGroupFilter: (groupId: string | null) => void;
  onRequestCreateGroup: (initialDraft?: Partial<TriggerGroupDraft>) => void;
  onRequestEditGroup: (group: TriggerGroup) => void;
  onGroupsChanged: () => Promise<void> | void;
}

export function TriggerGroupsSection({
  projectId,
  groups,
  discoveredClusters,
  triggers,
  dataMartTitlesById,
  activeGroupFilterId,
  onSelectGroupFilter,
  onRequestCreateGroup,
  onRequestEditGroup,
  onGroupsChanged,
}: TriggerGroupsSectionProps) {
  const isVi = isVietnameseLocale();
  const { scope } = useProjectRoute();
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<TriggerGroup | null>(null);
  const [deleteMemberTriggersToo, setDeleteMemberTriggersToo] = useState(false);

  const triggerById = new Map(triggers.map(t => [t.id, t]));

  for (const t of triggers) {
    if (!dataMartTitlesById.has(t.dataMart.id)) {
      dataMartTitlesById.set(t.dataMart.id, t.dataMart.title);
    }
  }

  const handleToggleGroup = async (group: TriggerGroup, nextActive: boolean) => {
    setBusyGroupId(group.id);
    try {
      const { updatedCount } = await toggleTriggerGroupActiveOnBackend(
        projectId,
        group,
        nextActive,
        triggers
      );
      toast.success(
        isVi
          ? `${nextActive ? 'Đã bật' : 'Đã tắt'} bộ trigger "${group.name}" (${updatedCount} trigger)`
          : `${nextActive ? 'Enabled' : 'Disabled'} trigger group "${group.name}" (${updatedCount} triggers)`
      );
      await onGroupsChanged();
    } finally {
      setBusyGroupId(null);
    }
  };

  const handleResyncGroup = async (group: TriggerGroup) => {
    setBusyGroupId(group.id);
    try {
      const result = await syncTriggerGroupWithBackend({
        projectId,
        draft: {
          name: group.name,
          description: group.description,
          dataMartIds: group.dataMartIds,
          triggerTypes: group.triggerTypes,
          reportSelectionMode: group.reportSelectionMode,
          selectedReportIds: group.selectedReportIds,
          cronExpression: group.cronExpression,
          timeZone: group.timeZone,
          isActive: group.isActive,
        },
        existingGroup: group,
        existingTriggers: triggers,
      });
      toast.success(
        isVi
          ? `Đã đồng bộ lại "${group.name}" (Tạo mới: ${result.createdCount}, Cập nhật: ${result.updatedCount})`
          : `Re-synced "${group.name}" (Created: ${result.createdCount}, Updated: ${result.updatedCount})`
      );
      await onGroupsChanged();
    } finally {
      setBusyGroupId(null);
    }
  };

  const handleConfirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    setBusyGroupId(groupToDelete.id);
    try {
      const { deletedCount } = await deleteTriggerGroupOnBackend(
        projectId,
        groupToDelete,
        deleteMemberTriggersToo
      );
      if (activeGroupFilterId === groupToDelete.id) {
        onSelectGroupFilter(null);
      }
      toast.success(
        deleteMemberTriggersToo
          ? isVi
            ? `Đã xóa bộ trigger "${groupToDelete.name}" và ${deletedCount} trigger thành viên`
            : `Deleted trigger group "${groupToDelete.name}" and ${deletedCount} member triggers`
          : isVi
            ? `Đã xóa bộ trigger "${groupToDelete.name}" (giữ nguyên các trigger đơn lẻ)`
            : `Removed trigger group "${groupToDelete.name}" (kept individual triggers)`
      );
      setGroupToDelete(null);
      setDeleteMemberTriggersToo(false);
      await onGroupsChanged();
    } finally {
      setBusyGroupId(null);
    }
  };

  return (
    <div className='mb-4 space-y-3' data-testid='triggerGroupsSection'>
      {/* Danh sách Bộ Trigger nhóm */}
      <div className='dm-card p-4'>
        <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <Layers className='text-primary h-4 w-4' />
            <h2 className='text-sm font-semibold'>
              {isVi ? 'Bộ Trigger nhóm Data Mart' : 'Data Mart Trigger Groups'}
            </h2>
            <Badge variant='secondary' className='text-xs'>
              {groups.length}
            </Badge>
            {activeGroupFilterId && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-6 px-2 text-xs'
                onClick={() => {
                  onSelectGroupFilter(null);
                }}
              >
                {isVi ? 'Bỏ lọc theo nhóm' : 'Clear group filter'}
              </Button>
            )}
          </div>

          {groups.length > 0 && (
            <Button
              type='button'
              variant='default'
              size='sm'
              onClick={() => {
                onRequestCreateGroup();
              }}
              data-testid='createTriggerGroupBtn'
            >
              <Plus className='h-3.5 w-3.5' />
              {isVi ? 'Tạo Bộ Trigger nhóm' : 'Create Trigger Group'}
            </Button>
          )}
        </div>

        {groups.length === 0 ? (
          <div className='border-border/70 bg-muted/20 flex flex-col items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-4 sm:flex-row'>
            <div className='space-y-1 text-center sm:text-left'>
              <p className='text-sm font-medium'>
                {isVi
                  ? 'Quản lý lịch chạy tự động chung cho cả nhóm Data Mart'
                  : 'Manage shared automatic schedules across a group of Data Marts'}
              </p>
              <p className='text-muted-foreground text-xs'>
                {isVi
                  ? 'Gom nhiều Data Mart vào một Bộ Trigger để đồng bộ lịch Chạy trình kết nối, Kiểm tra chất lượng dữ liệu và Chạy báo cáo cùng lúc.'
                  : 'Group multiple Data Marts into a single Trigger Group to synchronize Connector runs, Data Quality checks, and Report runs together.'}
              </p>
            </div>
            <Button
              type='button'
              variant='default'
              size='sm'
              className='shrink-0'
              onClick={() => {
                onRequestCreateGroup();
              }}
              data-testid='createTriggerGroupBtn'
            >
              <Plus className='h-4 w-4' />
              {isVi ? 'Tạo Bộ Trigger nhóm' : 'Create Trigger Group'}
            </Button>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
            {groups.map(group => {
              const isSelectedFilter = activeGroupFilterId === group.id;
              const isBusy = busyGroupId === group.id;
              const linkedTriggers = group.memberTriggerRefs
                .map(ref => triggerById.get(ref.triggerId))
                .filter((t): t is ProjectScheduledTrigger => Boolean(t));

              const earliestNextRun = linkedTriggers.reduce<Date | null>((earliest, item) => {
                if (!item.nextRun) return earliest;
                if (!earliest || item.nextRun < earliest) return item.nextRun;
                return earliest;
              }, null);

              return (
                <div
                  key={group.id}
                  data-testid={`triggerGroupCard-${group.id}`}
                  className={`flex flex-col justify-between gap-3 rounded-lg border p-3.5 transition-all ${
                    isSelectedFilter
                      ? 'border-primary bg-primary/5 ring-primary/20 ring-1'
                      : 'border-border bg-background hover:border-primary/40'
                  }`}
                >
                  <div className='space-y-2.5'>
                    <div className='flex items-start justify-between gap-2'>
                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <button
                            type='button'
                            onClick={() => {
                              onSelectGroupFilter(isSelectedFilter ? null : group.id);
                            }}
                            className='hover:text-primary truncate text-left text-sm font-semibold transition-colors'
                            title={
                              isVi
                                ? 'Nhấn để lọc bảng trigger theo bộ này'
                                : 'Click to filter table by this group'
                            }
                          >
                            {group.name}
                          </button>
                          <Badge
                            variant={group.isActive ? 'default' : 'outline'}
                            className='h-5 px-1.5 text-[10px]'
                          >
                            {group.isActive
                              ? isVi
                                ? 'Đang hoạt động'
                                : 'Active'
                              : isVi
                                ? 'Đã tắt'
                                : 'Disabled'}
                          </Badge>
                        </div>
                        {group.description && (
                          <p className='text-muted-foreground mt-0.5 line-clamp-1 text-xs'>
                            {group.description}
                          </p>
                        )}
                      </div>

                      <div className='flex shrink-0 items-center gap-1'>
                        <Switch
                          checked={group.isActive}
                          disabled={isBusy}
                          onCheckedChange={checked => {
                            void handleToggleGroup(group, checked);
                          }}
                          aria-label={
                            isVi
                              ? `Bật/tắt bộ trigger ${group.name}`
                              : `Toggle trigger group ${group.name}`
                          }
                          data-testid={`toggleTriggerGroup-${group.id}`}
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7'
                          disabled={isBusy}
                          onClick={() => {
                            void handleResyncGroup(group);
                          }}
                          title={
                            isVi
                              ? 'Đồng bộ lại lịch chạy cho toàn bộ Data Mart trong nhóm'
                              : 'Re-sync schedule across all Data Marts in group'
                          }
                          data-testid={`resyncTriggerGroup-${group.id}`}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7'
                          disabled={isBusy}
                          onClick={() => {
                            onRequestEditGroup(group);
                          }}
                          title={isVi ? 'Chỉnh sửa Bộ Trigger' : 'Edit Trigger Group'}
                          data-testid={`editTriggerGroup-${group.id}`}
                        >
                          <Pencil className='h-3.5 w-3.5' />
                        </Button>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='text-destructive hover:text-destructive h-7 w-7'
                          disabled={isBusy}
                          onClick={() => {
                            setGroupToDelete(group);
                            setDeleteMemberTriggersToo(false);
                          }}
                          title={isVi ? 'Xóa Bộ Trigger' : 'Delete Trigger Group'}
                          data-testid={`deleteTriggerGroup-${group.id}`}
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                        </Button>
                      </div>
                    </div>

                    {/* Loại tác vụ & Danh sách Data Mart */}
                    <div className='flex flex-wrap items-center gap-1.5'>
                      {group.triggerTypes.map(type => (
                        <Badge key={type} variant='outline' className='text-[11px]'>
                          {getScheduledTriggerTypeLabel(type)}
                        </Badge>
                      ))}
                      <span className='text-muted-foreground text-xs'>•</span>
                      <span className='text-muted-foreground flex items-center gap-1 text-xs'>
                        <Database className='h-3 w-3' />
                        {isVi
                          ? `${group.dataMartIds.length} Data Mart (${linkedTriggers.length} trigger đồng bộ)`
                          : `${group.dataMartIds.length} Data Marts (${linkedTriggers.length} synced triggers)`}
                      </span>
                    </div>

                    {/* Các Data Mart thành viên */}
                    <div className='flex flex-wrap items-center gap-1.5'>
                      {group.dataMartIds.slice(0, 5).map(dmId => {
                        const dmTitle = dataMartTitlesById.get(dmId) ?? dmId;
                        return (
                          <Link
                            key={dmId}
                            to={scope(`/data-marts/${dmId}/triggers`)}
                            className='bg-muted/60 hover:bg-muted text-foreground inline-flex max-w-[200px] items-center truncate rounded px-2 py-0.5 text-xs transition-colors'
                          >
                            {dmTitle}
                          </Link>
                        );
                      })}
                      {group.dataMartIds.length > 5 && (
                        <span className='text-muted-foreground text-xs'>
                          +{group.dataMartIds.length - 5}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer Lịch chạy & Lần chạy tiếp theo */}
                  <div className='border-border/60 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs'>
                    <div className='flex items-center gap-1.5'>
                      <CalendarClock className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
                      <ScheduleDisplay
                        cronExpression={group.cronExpression}
                        timeZone={group.timeZone}
                        isEnabled={group.isActive}
                      />
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {earliestNextRun ? (
                        <span>
                          {isVi ? 'Chạy tiếp: ' : 'Next: '}
                          <RelativeTime date={earliestNextRun} />
                        </span>
                      ) : isVi ? (
                        'Chưa lên lịch'
                      ) : (
                        'Not scheduled'
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gợi ý gom nhóm tự động khi có nhiều Data Mart dùng chung lịch chạy */}
      {discoveredClusters.length > 0 && (
        <div
          className='border-primary/25 bg-primary/5 flex flex-col gap-2.5 rounded-lg border px-4 py-3'
          data-testid='discoveredScheduleClustersBanner'
        >
          <div className='flex items-center gap-2 text-xs font-medium'>
            <Sparkles className='text-primary h-4 w-4 shrink-0' />
            <span>
              {isVi
                ? `Phát hiện ${discoveredClusters.length} cụm lịch chạy trùng khớp giữa nhiều Data Mart — có thể gom thành Bộ Trigger quản lý chung:`
                : `Detected ${discoveredClusters.length} shared schedule clusters across multiple Data Marts — group them for unified management:`}
            </span>
          </div>
          <div className='flex flex-wrap gap-2'>
            {discoveredClusters.map((cluster, idx) => (
              <div
                key={cluster.key}
                className='border-border bg-background flex items-center gap-2.5 rounded-md border px-3 py-1.5 text-xs'
              >
                <ScheduleDisplay
                  cronExpression={cluster.cronExpression}
                  timeZone={cluster.timeZone}
                  isEnabled={true}
                />
                <span className='text-muted-foreground'>
                  ({cluster.dataMarts.length} Data Mart • {cluster.triggers.length} trigger)
                </span>
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  className='h-6 px-2 text-xs'
                  data-testid={`convertClusterToGroupBtn-${idx}`}
                  onClick={() => {
                    onRequestCreateGroup({
                      name: isVi
                        ? `Bộ Trigger ${cluster.dataMarts.map(d => d.title).slice(0, 2).join(', ')}`
                        : `Trigger Group (${cluster.dataMarts.map(d => d.title).slice(0, 2).join(', ')})`,
                      dataMartIds: cluster.dataMarts.map(d => d.id),
                      triggerTypes: cluster.triggerTypes,
                      cronExpression: cluster.cronExpression,
                      timeZone: cluster.timeZone,
                      isActive: true,
                    });
                  }}
                >
                  <Layers className='mr-1 h-3 w-3' />
                  {isVi ? 'Gom thành Bộ Trigger' : 'Group Triggers'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hộp thoại xác nhận xóa Bộ Trigger */}
      <AlertDialog
        open={groupToDelete !== null}
        onOpenChange={open => {
          if (!open) setGroupToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isVi
                ? `Xóa Bộ Trigger "${groupToDelete?.name ?? ''}"?`
                : `Delete Trigger Group "${groupToDelete?.name ?? ''}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className='space-y-3 text-sm'>
                <p>
                  {isVi
                    ? `Bộ Trigger này đang quản lý ${groupToDelete?.dataMartIds.length ?? 0} Data Mart (${groupToDelete?.memberTriggerRefs.length ?? 0} trigger liên kết).`
                    : `This group manages ${groupToDelete?.dataMartIds.length ?? 0} Data Marts (${groupToDelete?.memberTriggerRefs.length ?? 0} linked triggers).`}
                </p>
                <label className='text-foreground flex cursor-pointer items-center gap-2 font-medium'>
                  <Checkbox
                    checked={deleteMemberTriggersToo}
                    onCheckedChange={checked => {
                      setDeleteMemberTriggersToo(Boolean(checked));
                    }}
                    data-testid='deleteMemberTriggersCheckbox'
                  />
                  <span>
                    {isVi
                      ? 'Đồng thời xóa luôn toàn bộ các trigger thành viên trong nhóm Data Mart này'
                      : 'Also delete all underlying triggers across the Data Marts in this group'}
                  </span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {isVi ? 'Hủy' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleConfirmDeleteGroup();
              }}
              className='bg-destructive hover:bg-destructive/90'
              data-testid='confirmDeleteTriggerGroupBtn'
            >
              {isVi ? 'Xóa Bộ Trigger' : 'Delete Group'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
