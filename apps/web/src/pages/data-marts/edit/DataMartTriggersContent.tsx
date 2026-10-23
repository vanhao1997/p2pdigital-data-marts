import { useState, useCallback, useEffect } from 'react';
import {
  CollapsibleCard,
  CollapsibleCardHeader,
  CollapsibleCardHeaderTitle,
  CollapsibleCardHeaderActions,
  CollapsibleCardContent,
  CollapsibleCardFooter,
} from '../../../shared/components/CollapsibleCard';
import { Badge } from '@owox/ui/components/badge';
import { Button } from '@owox/ui/components/button';
import { ArrowUpRight, CalendarClock, Layers, Pencil, Plus } from 'lucide-react';
import { Link, useParams } from 'react-router';
import {
  ScheduledTriggerFormSheet,
  ScheduledTriggerList,
  ScheduledTriggerProvider,
  useScheduledTriggerContext,
  TriggerGroupFormSheet,
  loadTriggerGroups,
  type TriggerGroup,
} from '../../../features/data-marts/scheduled-triggers';
import { useDataMartContext } from '../../../features/data-marts/edit/model';
import { ConnectorContextProvider } from '../../../features/connectors/shared/model/context';
import { DataMartDefinitionType } from '../../../features/data-marts/shared';
import { ScheduledTriggerType } from '../../../features/data-marts/scheduled-triggers/enums';
import { ScheduleDisplay } from '../../../features/data-marts/scheduled-triggers/components/ScheduleDisplay/ScheduleDisplay';
import { useProjectRoute } from '../../../shared/hooks';
import { useTranslation } from 'react-i18next';

function DataMartTriggersInner({
  dataMartId,
  hasConnector,
  isFormSheetOpen,
  onOpenFormSheet,
  onCloseFormSheet,
  isGroupSheetOpen,
  editingGroup,
  onOpenCreateGroup,
  onOpenEditGroup,
  onCloseGroupSheet,
}: {
  dataMartId: string;
  hasConnector: boolean;
  isFormSheetOpen: boolean;
  onOpenFormSheet: () => void;
  onCloseFormSheet: () => void;
  isGroupSheetOpen: boolean;
  editingGroup: TriggerGroup | null;
  onOpenCreateGroup: () => void;
  onOpenEditGroup: (group: TriggerGroup) => void;
  onCloseGroupSheet: () => void;
}) {
  const { i18n } = useTranslation();
  const isVi = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('vi');
  const { projectId = '0' } = useParams<{ projectId: string }>();
  const { scope } = useProjectRoute();
  const { getScheduledTriggers } = useScheduledTriggerContext();
  const [memberGroups, setMemberGroups] = useState<TriggerGroup[]>([]);

  const refreshMemberGroups = useCallback(() => {
    const allGroups = loadTriggerGroups(projectId);
    setMemberGroups(allGroups.filter(g => g.dataMartIds.includes(dataMartId)));
  }, [projectId, dataMartId]);

  useEffect(() => {
    refreshMemberGroups();
  }, [refreshMemberGroups]);

  return (
    <div className='space-y-4'>
      {/* Khối hiển thị và điều hướng Bộ Trigger nhóm của Data Mart hiện tại */}
      <div
        className='border-border/80 bg-muted/20 flex flex-col gap-2.5 rounded-lg border px-3.5 py-3'
        data-testid='dataMartTriggerGroupsBanner'
      >
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <Layers className='text-primary h-4 w-4 shrink-0' />
            <span className='text-xs font-semibold'>
              {isVi
                ? 'Bộ Trigger nhóm áp dụng cho Data Mart này'
                : 'Trigger Groups linked to this Data Mart'}
            </span>
            <Badge variant='secondary' className='h-5 px-1.5 text-[10px]'>
              {memberGroups.length}
            </Badge>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-7 px-2 text-xs'
              onClick={onOpenCreateGroup}
              data-testid='bannerCreateTriggerGroupBtn'
            >
              <Plus className='h-3.5 w-3.5' />
              {isVi ? 'Tạo Bộ Trigger nhóm mới' : 'Create Trigger Group'}
            </Button>
            <Button type='button' variant='outline' size='sm' className='h-7 px-2.5 text-xs' asChild>
              <Link to={scope('/data-marts/schedules')} data-testid='manageAllTriggerGroupsLink'>
                {isVi ? 'Quản lý tất cả Bộ Trigger nhóm' : 'Manage all Trigger Groups'}
                <ArrowUpRight className='h-3.5 w-3.5' />
              </Link>
            </Button>
          </div>
        </div>

        {memberGroups.length === 0 ? (
          <p className='text-muted-foreground text-xs'>
            {isVi
              ? 'Data Mart này hiện chỉ dùng trigger đơn lẻ. Bạn có thể gom Data Mart này cùng các Data Mart khác vào một Bộ Trigger nhóm để đồng bộ lịch chạy chung.'
              : 'This Data Mart currently uses individual triggers only. Group it with other Data Marts into a Trigger Group to share a unified schedule.'}
          </p>
        ) : (
          <div className='flex flex-wrap gap-2'>
            {memberGroups.map(group => (
              <div
                key={group.id}
                className='border-border bg-background flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-xs'
              >
                <span className='font-medium'>{group.name}</span>
                <Badge
                  variant={group.isActive ? 'default' : 'outline'}
                  className='h-4 px-1.5 text-[10px]'
                >
                  {group.isActive
                    ? isVi
                      ? 'Đang bật'
                      : 'Active'
                    : isVi
                      ? 'Đã tắt'
                      : 'Disabled'}
                </Badge>
                <span className='text-muted-foreground'>•</span>
                <ScheduleDisplay
                  cronExpression={group.cronExpression}
                  timeZone={group.timeZone}
                  isEnabled={group.isActive}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='h-6 w-6'
                  onClick={() => {
                    onOpenEditGroup(group);
                  }}
                  title={isVi ? 'Chỉnh sửa Bộ Trigger nhóm' : 'Edit Trigger Group'}
                >
                  <Pencil className='h-3 w-3' />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ScheduledTriggerList dataMartId={dataMartId} onRequestCreate={onOpenFormSheet} />

      <ScheduledTriggerFormSheet
        isOpen={isFormSheetOpen}
        onClose={onCloseFormSheet}
        dataMartId={dataMartId}
        preSelectedType={hasConnector ? ScheduledTriggerType.CONNECTOR_RUN : undefined}
      />

      <TriggerGroupFormSheet
        isOpen={isGroupSheetOpen}
        onClose={onCloseGroupSheet}
        projectId={projectId}
        existingGroup={editingGroup}
        initialDraft={editingGroup ? undefined : { dataMartIds: [dataMartId] }}
        onSaved={async () => {
          refreshMemberGroups();
          await getScheduledTriggers(dataMartId);
        }}
      />
    </div>
  );
}

export default function DataMartTriggersContent() {
  const { dataMart } = useDataMartContext();
  const { t, i18n } = useTranslation();
  const isVi = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('vi');
  const [isFormSheetOpen, setIsFormSheetOpen] = useState(false);
  const [isGroupSheetOpen, setIsGroupSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TriggerGroup | null>(null);
  const hasConnector = dataMart?.definitionType === DataMartDefinitionType.CONNECTOR;

  const handleOpenFormSheet = useCallback(() => {
    setIsFormSheetOpen(true);
  }, []);

  const handleCloseFormSheet = useCallback(() => {
    setIsFormSheetOpen(false);
  }, []);

  const handleOpenCreateGroup = useCallback(() => {
    setEditingGroup(null);
    setIsGroupSheetOpen(true);
  }, []);

  const handleOpenEditGroup = useCallback((group: TriggerGroup) => {
    setEditingGroup(group);
    setIsGroupSheetOpen(true);
  }, []);

  const handleCloseGroupSheet = useCallback(() => {
    setIsGroupSheetOpen(false);
    setEditingGroup(null);
  }, []);

  return (
    <div data-testid='triggerTab'>
      <CollapsibleCard>
        <CollapsibleCardHeader>
          <CollapsibleCardHeaderTitle
            icon={CalendarClock}
            tooltip={t(
              'scheduledTriggers.timeTooltip',
              'Time triggers allow you to schedule Data Mart runs at specific times'
            )}
          >
            {t('scheduledTriggers.timeTitle', 'Time triggers')}
          </CollapsibleCardHeaderTitle>
          <CollapsibleCardHeaderActions>
            <Button
              variant='outline'
              onClick={handleOpenCreateGroup}
              data-testid='openTriggerGroupFromDataMartBtn'
            >
              <Layers className='h-4 w-4' aria-hidden='true' />
              {isVi ? 'Bộ Trigger nhóm' : 'Trigger Group'}
            </Button>
            <Button
              variant='outline'
              onClick={handleOpenFormSheet}
              aria-label={t('scheduledTriggers.add', 'Add new trigger')}
              data-testid='triggerCreateButton'
            >
              <Plus className='h-4 w-4' aria-hidden='true' />
              {t('scheduledTriggers.new', 'New trigger')}
            </Button>
          </CollapsibleCardHeaderActions>
        </CollapsibleCardHeader>
        <CollapsibleCardContent>
          <ConnectorContextProvider>
            <ScheduledTriggerProvider>
              {dataMart && (
                <DataMartTriggersInner
                  dataMartId={dataMart.id}
                  hasConnector={hasConnector}
                  isFormSheetOpen={isFormSheetOpen}
                  onOpenFormSheet={handleOpenFormSheet}
                  onCloseFormSheet={handleCloseFormSheet}
                  isGroupSheetOpen={isGroupSheetOpen}
                  editingGroup={editingGroup}
                  onOpenCreateGroup={handleOpenCreateGroup}
                  onOpenEditGroup={handleOpenEditGroup}
                  onCloseGroupSheet={handleCloseGroupSheet}
                />
              )}
            </ScheduledTriggerProvider>
          </ConnectorContextProvider>
        </CollapsibleCardContent>
        <CollapsibleCardFooter></CollapsibleCardFooter>
      </CollapsibleCard>
    </div>
  );
}
