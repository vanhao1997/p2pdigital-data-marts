import { useOutletContext } from 'react-router';
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DataMartOverview } from '../../../features/data-marts/edit';
import { OwnersEditor } from '../../../features/data-marts/edit/components/OwnersEditor';
import { UserReference } from '../../../shared/components/UserReference/UserReference';
import {
  CollapsibleCard,
  CollapsibleCardHeader,
  CollapsibleCardHeaderTitle,
  CollapsibleCardContent,
  CollapsibleCardFooter,
} from '../../../shared/components/CollapsibleCard';
import {
  BookOpenIcon,
  CalendarIcon,
  Globe,
  History,
  Info,
  Lock,
  RefreshCw,
  Tags,
  Users,
} from 'lucide-react';
import { ContextPicker } from '../../../features/contexts/components/ContextPicker/ContextPicker';
import { AddContextSheet } from '../../../features/contexts/components/AddContextSheet/AddContextSheet';
import { useInlineContextCreate } from '../../../features/contexts/hooks/useInlineContextCreate';
import { useIsAdmin } from '../../../features/idp/hooks/useRole';
import { Switch } from '@owox/ui/components/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import type { UserProjectionDto } from '../../../shared/types/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@owox/ui/components/tooltip';
import { dataMartService } from '../../../features/data-marts/shared/services/data-mart.service';
import { DataLastUpdatedValue } from '../../../features/data-marts/shared/components/DataLastUpdatedValue';
import type { DataLastUpdatedDto } from '../../../features/data-marts/shared/types/api/response/data-mart-data-last-updated.dto';

interface OutletContextType {
  dataMart: {
    id: string;
    description: string;
    createdAt: Date;
    createdByUser: UserProjectionDto | null;
    businessOwnerUsers: UserProjectionDto[];
    technicalOwnerUsers: UserProjectionDto[];
    availableForReporting?: boolean;
    availableForMaintenance?: boolean;
    contexts?: { id: string; name: string }[];
    dataLastUpdated?: DataLastUpdatedDto | null;
  };
  updateDataMartOwners: (
    id: string,
    businessOwnerIds: string[],
    technicalOwnerIds: string[]
  ) => Promise<void>;
  getDataMart: (id: string) => Promise<void>;
  projectId: string;
}

export default function DataMartOverviewContent() {
  const { t, i18n } = useTranslation();
  const { dataMart, updateDataMartOwners, getDataMart, projectId } =
    useOutletContext<OutletContextType>();

  const [availableForReporting, setAvailableForReporting] = useState(
    dataMart.availableForReporting !== false
  );
  const [availableForMaintenance, setAvailableForMaintenance] = useState(
    dataMart.availableForMaintenance !== false
  );
  const [contextIds, setContextIds] = useState<string[]>((dataMart.contexts ?? []).map(c => c.id));
  // Only the refresh RESULT is state; the displayed value is derived. Mirroring the prop into
  // state would let a later refetch (renaming the mart, toggling sharing) overwrite a fresh
  // measurement with the older persisted snapshot — and an "unavailable" result is deliberately
  // not persisted, so that revert would be silent and wrong.
  const [refreshedDataLastUpdated, setRefreshedDataLastUpdated] =
    useState<DataLastUpdatedDto | null>(null);
  const [isRefreshingDataLastUpdated, setIsRefreshingDataLastUpdated] = useState(false);
  const dataLastUpdated = refreshedDataLastUpdated ?? dataMart.dataLastUpdated ?? null;

  const isAdmin = useIsAdmin();

  // Sync local state when dataMart props change (after refetch)
  useEffect(() => {
    setAvailableForReporting(dataMart.availableForReporting !== false);
    setAvailableForMaintenance(dataMart.availableForMaintenance !== false);
  }, [dataMart.availableForReporting, dataMart.availableForMaintenance]);

  useEffect(() => {
    setContextIds((dataMart.contexts ?? []).map(c => c.id));
  }, [dataMart.contexts]);

  // A measurement belongs to ONE Data Mart. On a route-param-only navigation this component can
  // stay mounted, and without the reset mart A's fresh result would render on mart B.
  useEffect(() => {
    setRefreshedDataLastUpdated(null);
  }, [dataMart.id, t]);

  const handleRefreshDataLastUpdated = useCallback(async () => {
    setIsRefreshingDataLastUpdated(true);
    try {
      // The backend answers `coverage: "unavailable"` instead of erroring, so a catch here
      // means transport, not "could not determine". An id it could not measure is absent from
      // the response, in which case the previously known value stays on screen.
      const { items } = await dataMartService.refreshDataLastUpdated([dataMart.id]);
      const fresh = items.find(item => item.dataMartId === dataMart.id)?.dataLastUpdated;
      if (fresh) {
        setRefreshedDataLastUpdated(fresh);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('dataMartOverview.errors.checkLastUpdated', 'Failed to check Data Last Updated')
      );
    } finally {
      setIsRefreshingDataLastUpdated(false);
    }
  }, [dataMart.id, t]);

  const handleAvailabilityChange = useCallback(
    async (reporting: boolean, maintenance: boolean) => {
      try {
        await dataMartService.updateDataMartAvailability(dataMart.id, {
          availableForReporting: reporting,
          availableForMaintenance: maintenance,
        });
        toast.success(t('dataMartOverview.toasts.sharingUpdated', 'Sharing updated'));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('dataMartOverview.errors.updateSharing', 'Failed to update sharing')
        );
      } finally {
        void getDataMart(dataMart.id);
      }
    },
    [dataMart.id, getDataMart, t]
  );

  const persistContexts = useCallback(
    (next: string[]) => {
      setContextIds(next);
      void (async () => {
        try {
          await dataMartService.updateContexts(dataMart.id, next);
          toast.success(t('dataMartOverview.toasts.contextsUpdated', 'Contexts updated'));
          void getDataMart(dataMart.id);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : t('dataMartOverview.errors.updateContexts', 'Failed to update contexts')
          );
          void getDataMart(dataMart.id);
        }
      })();
    },
    [dataMart.id, getDataMart, t]
  );

  const inlineContext = useInlineContextCreate({
    enabled: isAdmin,
    onCreated: created => {
      setContextIds(prev => {
        if (prev.includes(created.id)) return prev;
        const next = [...prev, created.id];
        persistContexts(next);
        return next;
      });
    },
  });

  return (
    <div data-testid='datamartTabOverview' className='flex flex-col gap-4'>
      <CollapsibleCard collapsible name='dm-description'>
        <CollapsibleCardHeader>
          <CollapsibleCardHeaderTitle
            icon={BookOpenIcon}
            tooltip={t('dataMartOverview.descriptionTooltip', 'Description of this Data Mart')}
          >
            {t('dataMartOverview.description', 'Description')}
          </CollapsibleCardHeaderTitle>
        </CollapsibleCardHeader>
        <CollapsibleCardContent>
          <DataMartOverview />
        </CollapsibleCardContent>
        <CollapsibleCardFooter></CollapsibleCardFooter>
      </CollapsibleCard>

      <CollapsibleCard collapsible name='dm-owners'>
        <CollapsibleCardHeader>
          <CollapsibleCardHeaderTitle
            icon={Users}
            tooltip={t(
              'dataMartOverview.ownershipTooltip',
              'Define who owns and maintains this Data Mart'
            )}
          >
            {t('dataMartOverview.ownership', 'Ownership')}
          </CollapsibleCardHeaderTitle>
        </CollapsibleCardHeader>
        <CollapsibleCardContent>
          <div className='flex gap-4'>
            <div className='group flex w-full flex-col gap-4 rounded-md border-b border-gray-200 bg-white p-4 transition-shadow duration-200 hover:shadow-xs dark:border-0 dark:bg-white/2'>
              <div className='text-foreground flex items-center justify-between gap-2 text-sm font-medium'>
                <span>{t('dataMartOverview.technicalOwner', 'Technical owner')}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type='button'
                      tabIndex={-1}
                      className='pointer-events-none opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100'
                      aria-label={t('dataMartOverview.helpInformation', 'Help information')}
                    >
                      <Info
                        className='text-muted-foreground/50 hover:text-muted-foreground size-4 shrink-0 transition-colors'
                        aria-hidden='true'
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side='top' align='center' role='tooltip'>
                    {t(
                      'dataMartOverview.technicalOwnerHelp',
                      'Responsible for data sources and schema'
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
              <OwnersEditor
                ownerUsers={dataMart.technicalOwnerUsers}
                projectId={projectId}
                onSave={users => {
                  void updateDataMartOwners(
                    dataMart.id,
                    dataMart.businessOwnerUsers.map(u => u.userId),
                    users.map(u => u.userId)
                  );
                }}
              />
              <Accordion variant='common' type='single' collapsible>
                <AccordionItem value='technical-owner-help'>
                  <AccordionTrigger>
                    {t('dataMartOverview.technicalOwnerQuestion', 'What is a Technical Owner?')}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p>
                      {t(
                        'dataMartOverview.technicalOwnerIntro',
                        'Technical Owner is direct maintenance ownership of this Data Mart.'
                      )}
                    </p>
                    <p>
                      {t(
                        'dataMartOverview.technicalOwnerPermissions',
                        "When the owner's role is Technical User or Project Admin, they may edit and delete the Data Mart, configure its Sharing, and maintain its Triggers, Reports and nested Report Triggers — regardless of Sharing settings."
                      )}
                    </p>
                    <p>
                      {t(
                        'dataMartOverview.technicalOwnerBusinessUser',
                        'Assigning Technical Owner to a Business User stores the assignment but grants no maintenance permissions until the role changes.'
                      )}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            <div className='group flex w-full flex-col gap-4 rounded-md border-b border-gray-200 bg-white p-4 transition-shadow duration-200 hover:shadow-xs dark:border-0 dark:bg-white/2'>
              <div className='text-foreground flex items-center justify-between gap-2 text-sm font-medium'>
                <span>{t('dataMartOverview.businessOwner', 'Business owner')}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type='button'
                      tabIndex={-1}
                      className='pointer-events-none opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100'
                      aria-label={t('dataMartOverview.helpInformation', 'Help information')}
                    >
                      <Info
                        className='text-muted-foreground/50 hover:text-muted-foreground size-4 shrink-0 transition-colors'
                        aria-hidden='true'
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side='top' align='center' role='tooltip'>
                    {t(
                      'dataMartOverview.businessOwnerHelp',
                      'Responsible for business requirements'
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
              <OwnersEditor
                ownerUsers={dataMart.businessOwnerUsers}
                projectId={projectId}
                onSave={users => {
                  void updateDataMartOwners(
                    dataMart.id,
                    users.map(u => u.userId),
                    dataMart.technicalOwnerUsers.map(u => u.userId)
                  );
                }}
              />
              <Accordion variant='common' type='single' collapsible>
                <AccordionItem value='business-owner-help'>
                  <AccordionTrigger>
                    {t('dataMartOverview.businessOwnerQuestion', 'What is a Business Owner?')}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p>
                      {t(
                        'dataMartOverview.businessOwnerIntro',
                        'Business Owner is direct reporting ownership of this Data Mart.'
                      )}
                    </p>
                    <p>
                      {t(
                        'dataMartOverview.businessOwnerPermissions',
                        'Business Owners may see the Data Mart in the catalog, open it, use it for reporting, and see its Triggers, Reports and nested Report Triggers — regardless of Sharing settings.'
                      )}
                    </p>
                    <p>
                      {t(
                        'dataMartOverview.businessOwnerRestrictions',
                        'This role does not grant editing, deleting, Sharing management, Trigger maintenance, or changing owners.'
                      )}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </CollapsibleCardContent>
        <CollapsibleCardFooter></CollapsibleCardFooter>
      </CollapsibleCard>

      <CollapsibleCard collapsible name='dm-availability'>
        <CollapsibleCardHeader>
          <CollapsibleCardHeaderTitle
            icon={availableForReporting || availableForMaintenance ? Globe : Lock}
            tooltip={t(
              'dataMartOverview.sharingTooltip',
              'Control who can see and work with this Data Mart'
            )}
          >
            {t('dataMartOverview.sharing', 'Sharing')}
          </CollapsibleCardHeaderTitle>
        </CollapsibleCardHeader>
        <CollapsibleCardContent>
          <div className='flex gap-4'>
            <div className='group flex w-full flex-col gap-3 rounded-md border-b border-gray-200 bg-white p-4 transition-shadow duration-200 hover:shadow-xs dark:border-0 dark:bg-white/2'>
              <div className='flex items-center gap-2'>
                <Switch
                  id='available-for-maintenance'
                  checked={availableForMaintenance}
                  onCheckedChange={v => {
                    setAvailableForMaintenance(v);
                    void handleAvailabilityChange(availableForReporting, v);
                  }}
                />
                <label
                  htmlFor='available-for-maintenance'
                  className='text-foreground cursor-pointer text-sm font-medium select-none'
                >
                  {t('dataMartOverview.sharedForMaintenance', 'Shared for maintenance')}
                </label>
              </div>
              <p className='text-muted-foreground text-xs'>
                {t(
                  'dataMartOverview.maintenanceDescription',
                  'Technical users can edit, delete, and manage triggers for this Data Mart'
                )}
              </p>
              <Accordion variant='common' type='single' collapsible>
                <AccordionItem value='maintenance-help'>
                  <AccordionTrigger>
                    {t(
                      'dataMartOverview.maintenanceQuestion',
                      'What does "Shared for maintenance" mean?'
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p>
                      {t(
                        'dataMartOverview.maintenanceEnabled',
                        'When enabled, Technical Users who are not owners can edit the Data Mart definition, delete it, and manage its scheduled triggers.'
                      )}
                    </p>
                    <p>
                      {t(
                        'dataMartOverview.maintenanceBusinessUsers',
                        'Business Users are not affected by this setting.'
                      )}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            <div className='group flex w-full flex-col gap-3 rounded-md border-b border-gray-200 bg-white p-4 transition-shadow duration-200 hover:shadow-xs dark:border-0 dark:bg-white/2'>
              <div className='flex items-center gap-2'>
                <Switch
                  id='available-for-reporting'
                  checked={availableForReporting}
                  onCheckedChange={v => {
                    setAvailableForReporting(v);
                    void handleAvailabilityChange(v, availableForMaintenance);
                  }}
                />
                <label
                  htmlFor='available-for-reporting'
                  className='text-foreground cursor-pointer text-sm font-medium select-none'
                >
                  {t('dataMartOverview.sharedForReporting', 'Shared for reporting')}
                </label>
              </div>
              <p className='text-muted-foreground text-xs'>
                {t(
                  'dataMartOverview.reportingDescription',
                  'All project members can see this Data Mart and build reports on it'
                )}
              </p>
              <Accordion variant='common' type='single' collapsible>
                <AccordionItem value='reporting-help'>
                  <AccordionTrigger>
                    {t(
                      'dataMartOverview.reportingQuestion',
                      'What does "Shared for reporting" mean?'
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p>
                      {t(
                        'dataMartOverview.reportingEnabled',
                        'When enabled, all project members (both Technical and Business Users) can see this Data Mart in the catalog and use it to create reports.'
                      )}
                    </p>
                    <p>
                      {t(
                        'dataMartOverview.reportingOwners',
                        'Owners always have access regardless of this setting.'
                      )}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </CollapsibleCardContent>
        <CollapsibleCardFooter></CollapsibleCardFooter>
      </CollapsibleCard>

      <CollapsibleCard collapsible name='dm-contexts'>
        <CollapsibleCardHeader>
          <CollapsibleCardHeaderTitle
            icon={Tags}
            tooltip={t(
              'dataMartOverview.contextsTooltip',
              'Business domain contexts assigned to this Data Mart'
            )}
          >
            {t('dataMartOverview.contexts', 'Contexts')}
          </CollapsibleCardHeaderTitle>
        </CollapsibleCardHeader>
        <CollapsibleCardContent>
          <div className='group flex w-full flex-col gap-2'>
            <div className='rounded-md bg-white p-1 transition-shadow duration-200 hover:shadow-xs dark:bg-neutral-900'>
              <ContextPicker
                selectedContextIds={contextIds}
                onChange={persistContexts}
                idPrefix='dm-ctx'
                {...inlineContext.pickerProps}
              />
            </div>
            <Accordion variant='common' type='single' collapsible>
              <AccordionItem value='contexts-help'>
                <AccordionTrigger>
                  {t('dataMartOverview.contextsQuestion', 'What are Contexts?')}
                </AccordionTrigger>
                <AccordionContent>
                  <p>
                    {t(
                      'dataMartOverview.contextsIntro',
                      'Contexts are business domains (e.g. Marketing, Finance, Sales) used to group Data Marts, Storages and Destinations.'
                    )}
                  </p>
                  <p>
                    {t(
                      'dataMartOverview.contextsAccess',
                      'They also control access: a member with the role scope limited to specific contexts will only see resources assigned to those contexts.'
                    )}
                  </p>
                  <p>
                    {t(
                      'dataMartOverview.contextsAssign',
                      'Assign one or more contexts to make this Data Mart discoverable to the right people.'
                    )}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </CollapsibleCardContent>
        <CollapsibleCardFooter></CollapsibleCardFooter>
      </CollapsibleCard>

      <CollapsibleCard collapsible name='dm-details'>
        <CollapsibleCardHeader>
          <CollapsibleCardHeaderTitle
            icon={Info}
            tooltip={t('dataMartOverview.detailsTooltip', 'Metadata and additional details')}
          >
            {t('dataMartOverview.details', 'Details')}
          </CollapsibleCardHeaderTitle>
        </CollapsibleCardHeader>
        <CollapsibleCardContent>
          <div className='flex gap-4'>
            <div className='group flex w-full flex-col gap-4 rounded-md border-b border-gray-200 bg-white p-4 transition-shadow duration-200 hover:shadow-xs dark:border-0 dark:bg-white/2'>
              <div className='text-foreground flex items-center justify-between gap-2 text-sm font-medium'>
                <span>{t('dataMartOverview.createdOn', 'Created on')}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type='button'
                      tabIndex={-1}
                      className='pointer-events-none opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100'
                      aria-label={t('dataMartOverview.helpInformation', 'Help information')}
                    >
                      <Info
                        className='text-muted-foreground/50 hover:text-muted-foreground size-4 shrink-0 transition-colors'
                        aria-hidden='true'
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side='top' align='center' role='tooltip'>
                    {t('dataMartOverview.createdOnHelp', 'When this Data Mart was created')}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className='flex items-center gap-2'>
                <div className='inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-100 py-1 pr-3 pl-1 dark:bg-neutral-900'>
                  <div className='flex aspect-square h-7 w-7 items-center justify-center rounded-full border bg-white dark:bg-white/10'>
                    <CalendarIcon
                      className='text-muted-foreground size-3.5 shrink-0 transition-colors'
                      aria-hidden='true'
                    />
                  </div>
                  <div className='text-muted-foreground min-w-0 truncate text-sm leading-tight'>
                    {new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    }).format(new Date(dataMart.createdAt))}
                  </div>
                </div>
              </div>
            </div>
            <div className='group flex w-full flex-col gap-4 rounded-md border-b border-gray-200 bg-white p-4 transition-shadow duration-200 hover:shadow-xs dark:border-0 dark:bg-white/2'>
              <div className='text-foreground flex items-center justify-between gap-2 text-sm font-medium'>
                <span>{t('dataMartOverview.dataLastUpdated', 'Data last updated')}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type='button'
                      tabIndex={-1}
                      className='pointer-events-none opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100'
                      aria-label={t('dataMartOverview.helpInformation', 'Help information')}
                    >
                      <Info
                        className='text-muted-foreground/50 hover:text-muted-foreground size-4 shrink-0 transition-colors'
                        aria-hidden='true'
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side='top' align='center' role='tooltip'>
                    {t(
                      'dataMartOverview.dataLastUpdatedHelp',
                      "When this Data Mart's source tables last changed in the storage — not which period the data covers"
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className='flex items-center gap-2'>
                <div className='inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-100 py-1 pr-3 pl-1 dark:bg-neutral-900'>
                  <div className='flex aspect-square h-7 w-7 items-center justify-center rounded-full border bg-white dark:bg-white/10'>
                    <History
                      className='text-muted-foreground size-3.5 shrink-0 transition-colors'
                      aria-hidden='true'
                    />
                  </div>
                  <div className='text-muted-foreground min-w-0 truncate text-sm leading-tight'>
                    <DataLastUpdatedValue block={dataLastUpdated} compact />
                  </div>
                </div>
                <button
                  type='button'
                  onClick={() => void handleRefreshDataLastUpdated()}
                  disabled={isRefreshingDataLastUpdated}
                  aria-label={t('dataMartOverview.checkLastUpdated', 'Check Data Last Updated now')}
                  title={t('dataMartOverview.checkNow', 'Check now')}
                  className='text-muted-foreground hover:text-foreground flex aspect-square h-7 w-7 items-center justify-center rounded-full border bg-white transition-colors disabled:opacity-50 dark:bg-white/10'
                >
                  <RefreshCw
                    className={`size-3.5 shrink-0 ${isRefreshingDataLastUpdated ? 'animate-spin' : ''}`}
                    aria-hidden='true'
                  />
                </button>
              </div>
            </div>
            {dataMart.createdByUser && (
              <div className='group flex w-full flex-col gap-4 rounded-md border-b border-gray-200 bg-white p-4 transition-shadow duration-200 hover:shadow-xs dark:border-0 dark:bg-white/2'>
                <div className='text-foreground flex items-center justify-between gap-2 text-sm font-medium'>
                  <span>{t('dataMartOverview.createdBy', 'Created by')}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type='button'
                        tabIndex={-1}
                        className='pointer-events-none opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100'
                        aria-label={t('dataMartOverview.helpInformation', 'Help information')}
                      >
                        <Info
                          className='text-muted-foreground/50 hover:text-muted-foreground size-4 shrink-0 transition-colors'
                          aria-hidden='true'
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side='top' align='center' role='tooltip'>
                      {t('dataMartOverview.createdByHelp', 'The user who created this Data Mart')}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className='flex items-center gap-2'>
                  <UserReference userProjection={dataMart.createdByUser} variant='full' />
                </div>
              </div>
            )}
          </div>
        </CollapsibleCardContent>
        <CollapsibleCardFooter></CollapsibleCardFooter>
      </CollapsibleCard>
      <AddContextSheet {...inlineContext.sheetProps} />
    </div>
  );
}
