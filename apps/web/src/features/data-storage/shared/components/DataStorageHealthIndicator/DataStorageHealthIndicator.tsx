import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  HoverCardHeader,
  HoverCardHeaderText,
  HoverCardHeaderTitle,
  HoverCardHeaderDescription,
  HoverCardBody,
  HoverCardItem,
  HoverCardItemValue,
} from '@owox/ui/components/hover-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@owox/ui/components/tooltip';
import { useDataStorageHealthStatus } from '../../model/hooks/useDataStorageHealthStatus';
import { DataStorageHealthStatus } from '../../services/data-storage-health-status.service';
import { DataStorageHealthStatusView } from './DataStorageHealthStatusView';
import { DataStorageHealthDot } from './DataStorageHealthDot';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

interface DataStorageHealthIndicatorProps {
  storageId: string;
  storageTitle?: string;
  hovercardSide?: 'top' | 'right' | 'bottom' | 'left';
  variant?: 'default' | 'compact';
}

interface HealthStatusDisplayConfig {
  dotClass: string;
  ringClass: string;
}

const HEALTH_STATUS_CONFIG: Record<DataStorageHealthStatus, HealthStatusDisplayConfig> = {
  [DataStorageHealthStatus.VALID]: {
    dotClass: 'bg-green-500',
    ringClass: 'ring-green-500/50',
  },
  [DataStorageHealthStatus.INVALID]: {
    dotClass: 'bg-red-500',
    ringClass: 'ring-red-500/50',
  },
  [DataStorageHealthStatus.UNCONFIGURED]: {
    dotClass: 'bg-neutral-400 dark:bg-neutral-500',
    ringClass: 'ring-neutral-400/50 dark:ring-neutral-500/50',
  },
  [DataStorageHealthStatus.REAUTH_REQUIRED]: {
    dotClass: 'bg-red-500',
    ringClass: 'ring-red-500/50',
  },
};
const HEALTH_STATUS_NOT_FETCHED: HealthStatusDisplayConfig = {
  dotClass: 'bg-neutral-300 dark:bg-neutral-600',
  ringClass: 'ring-neutral-300/50 dark:ring-neutral-600/50',
};

function getTooltipText(params: {
  status: DataStorageHealthStatus;
  isLoading: boolean;
  t: TFunction;
}): string {
  const { status, isLoading, t } = params;

  if (isLoading) return t('storageHealth.validating');

  const labels: Record<DataStorageHealthStatus, string> = {
    [DataStorageHealthStatus.VALID]: t('storageHealth.validTooltip'),
    [DataStorageHealthStatus.INVALID]: t('storageHealth.invalid'),
    [DataStorageHealthStatus.UNCONFIGURED]: t('storageHealth.unconfigured'),
    [DataStorageHealthStatus.REAUTH_REQUIRED]: t('storageHealth.reconnect'),
  };
  return labels[status];
}

function getCompactStatusMessage(
  status: DataStorageHealthStatus,
  errorMessage: string | undefined,
  t: TFunction
): string | undefined {
  if (status === DataStorageHealthStatus.INVALID) {
    return t('storageHealth.compactInvalid');
  }

  if (status === DataStorageHealthStatus.REAUTH_REQUIRED) {
    return t('storageHealth.reconnect');
  }

  return errorMessage;
}

export function DataStorageHealthIndicator({
  storageId,
  storageTitle,
  hovercardSide = 'bottom',
  variant = 'default',
}: DataStorageHealthIndicatorProps) {
  const { t } = useTranslation();
  const { status, errorMessage, isLoading, isFetched } = useDataStorageHealthStatus(storageId);

  const { dotClass, ringClass } = isFetched
    ? HEALTH_STATUS_CONFIG[status]
    : HEALTH_STATUS_NOT_FETCHED;

  if (variant === 'compact') {
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          <div className='group inline-flex h-6 w-6 cursor-pointer items-center justify-center'>
            <Tooltip>
              <TooltipTrigger asChild>
                <DataStorageHealthDot
                  dotClass={dotClass}
                  ringClass={ringClass}
                  isLoading={isLoading}
                />
              </TooltipTrigger>

              <TooltipContent side='top' align='center'>
                {getTooltipText({ status, isLoading, t })}
              </TooltipContent>
            </Tooltip>
          </div>
        </HoverCardTrigger>

        {isFetched && !isLoading && (
          <HoverCardContent side={hovercardSide} align='start'>
            <HoverCardHeader>
              <HoverCardHeaderText>
                <HoverCardHeaderTitle>
                  {storageTitle ?? t('storageHealth.validationTitle')}
                </HoverCardHeaderTitle>
                <HoverCardHeaderDescription>
                  {t('storageHealth.validationResult')}
                </HoverCardHeaderDescription>
              </HoverCardHeaderText>
            </HoverCardHeader>

            <HoverCardBody>
              <HoverCardItem>
                <HoverCardItemValue>
                  <DataStorageHealthStatusView
                    status={status}
                    errorMessage={getCompactStatusMessage(status, errorMessage, t)}
                  />
                </HoverCardItemValue>
              </HoverCardItem>
            </HoverCardBody>
          </HoverCardContent>
        )}
      </HoverCard>
    );
  }

  return (
    <DataStorageHealthStatusView
      status={status}
      errorMessage={errorMessage}
      isLoading={isLoading}
    />
  );
}
