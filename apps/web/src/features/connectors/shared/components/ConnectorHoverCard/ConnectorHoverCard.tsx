import { useMemo, useCallback, useState } from 'react';
import React from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  HoverCardHeader,
  HoverCardHeaderText,
  HoverCardHeaderIcon,
  HoverCardHeaderTitle,
  HoverCardHeaderDescription,
  HoverCardBody,
  HoverCardItem,
  HoverCardItemLabel,
  HoverCardItemValue,
  HoverCardFooter,
} from '@owox/ui/components/hover-card';
import { type ConnectorConfig } from '../../../../data-marts/edit';
import { useConnector } from '../../model/hooks/useConnector.ts';
import { useDataMartContext } from '../../../../data-marts/edit/model';
import { RawBase64Icon } from '../../../../../shared';
import { type ReactNode } from 'react';
import { Button } from '@owox/ui/components/button';
import { ExternalLink } from 'lucide-react';
import RelativeTime from '@owox/ui/components/common/relative-time';
import { StatusLabel } from '../../../../../shared/components/StatusLabel';
import { ConnectorNameDisplay } from '../ConnectorNameDisplay';
import {
  mapRunStatusToStatusType,
  getRunStatusText,
  DataMartRunType,
} from '../../../../data-marts/shared';
import { getRunDataInfo } from '../../../../data-marts/shared/utils/run-data.utils.ts';
import { getStorageButtonText, openStorageConsole } from '../../../../data-storage';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../../i18n';

interface ConnectorHoverCardProps {
  connector: ConnectorConfig;
  children: ReactNode;
}

const useConnectorData = (connectorName: string) => {
  const { connectors } = useConnector();
  return useMemo(() => connectors.find(c => c.name === connectorName), [connectors, connectorName]);
};

export const ConnectorHoverCard = React.memo(
  function ConnectorHoverCard({ connector, children }: ConnectorHoverCardProps) {
    const { t } = useTranslation();
    const connectorInfo = useConnectorData(connector.source.name);

    // Use controlled hover card to only load context data when open
    const [isOpen, setIsOpen] = useState(false);

    const connectorIcon = useMemo(() => {
      if (connectorInfo?.logoBase64) {
        return <RawBase64Icon base64={connectorInfo.logoBase64} size={20} />;
      }
      return null;
    }, [connectorInfo?.logoBase64]);

    const descriptionText = useMemo(() => {
      const fieldsCount = connector.source.fields.length.toString();
      return `${connector.source.node} • ${t('connectorHoverCard.fieldsCount', { count: fieldsCount })}`;
    }, [connector.source.node, connector.source.fields.length, t]);

    // Separate component for hover card content to isolate context usage
    const connectorFullyQualifiedName = connector.storage.fullyQualifiedName;
    const HoverCardContentInner = React.memo(() => {
      // This component only renders when hover card is open, reducing re-renders
      const { runs, dataMart } = useDataMartContext();

      // Extract stable values for dependency arrays
      const storage = dataMart?.storage;

      const runDataInfo = useMemo(
        () => getRunDataInfo(runs.filter(run => run.type === DataMartRunType.CONNECTOR)),
        [runs]
      );

      const lastRunDate = runDataInfo.lastRunDate;
      const lastRunStatusValue = runDataInfo.lastRunStatus;

      const lastRunStatus = useMemo(() => {
        if (!lastRunDate || !lastRunStatusValue) return null;
        return {
          statusType: mapRunStatusToStatusType(lastRunStatusValue),
          statusText: getRunStatusText(lastRunStatusValue),
          date: lastRunDate,
        };
      }, [lastRunDate, lastRunStatusValue]);

      const buttonText = useMemo(() => {
        return storage && getStorageButtonText(storage);
      }, [storage]);

      const handleStorageOpen = useCallback(() => {
        if (!storage) {
          return;
        }
        openStorageConsole(storage, connectorFullyQualifiedName);
      }, [storage]);

      return (
        <>
          <HoverCardBody>
            {lastRunStatus && (
              <HoverCardItem>
                <HoverCardItemLabel>{t('connectorHoverCard.lastRunStatus')}</HoverCardItemLabel>
                <HoverCardItemValue>
                  <StatusLabel type={lastRunStatus.statusType} variant='ghost'>
                    {lastRunStatus.statusText}
                  </StatusLabel>
                </HoverCardItemValue>
              </HoverCardItem>
            )}
            {lastRunStatus?.date && (
              <HoverCardItem>
                <HoverCardItemLabel>{t('connectorHoverCard.lastRunDate')}</HoverCardItemLabel>
                <HoverCardItemValue>
                  <RelativeTime date={lastRunStatus.date} />
                </HoverCardItemValue>
              </HoverCardItem>
            )}
            <HoverCardItem>
              {runDataInfo.totalRuns > 0 ? (
                <HoverCardItemLabel>{t('connectorHoverCard.totalRuns')}</HoverCardItemLabel>
              ) : (
                ''
              )}
              <HoverCardItemValue>
                {runDataInfo.totalRuns === 0
                  ? t('connectorHoverCard.noRuns')
                  : t('connectorHoverCard.runCount', { count: runDataInfo.totalRuns })}
                {runDataInfo.firstRunDate && (
                  <>
                    , {t('connectorHoverCard.since')}{' '}
                    {runDataInfo.firstRunDate.toLocaleDateString(
                      i18n.resolvedLanguage === 'vi' ? 'vi-VN' : 'en-US',
                      {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      }
                    )}
                  </>
                )}
              </HoverCardItemValue>
            </HoverCardItem>
          </HoverCardBody>

          <HoverCardFooter>
            <Button
              className='w-full'
              variant='default'
              onClick={handleStorageOpen}
              title={t('connectorHoverCard.openStorage')}
              aria-label={t('connectorHoverCard.openStorage')}
            >
              {buttonText}
              <ExternalLink className='ml-1 inline h-4 w-4' aria-hidden='true' />
            </Button>
          </HoverCardFooter>
        </>
      );
    });
    HoverCardContentInner.displayName = 'HoverCardContentInner';

    return (
      <HoverCard open={isOpen} onOpenChange={setIsOpen}>
        <HoverCardTrigger asChild>
          <span>{children}</span>
        </HoverCardTrigger>
        <HoverCardContent>
          <HoverCardHeader>
            <HoverCardHeaderIcon>{connectorIcon}</HoverCardHeaderIcon>
            <HoverCardHeaderText>
              <HoverCardHeaderTitle>
                <ConnectorNameDisplay connector={connector} />
              </HoverCardHeaderTitle>
              <HoverCardHeaderDescription>{descriptionText}</HoverCardHeaderDescription>
            </HoverCardHeaderText>
          </HoverCardHeader>
          {isOpen && <HoverCardContentInner />}
        </HoverCardContent>
      </HoverCard>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    // Compare all relevant connector properties to ensure we only re-render when connector actually changes
    const connectorChanged =
      prevProps.connector.source.name !== nextProps.connector.source.name ||
      prevProps.connector.storage.fullyQualifiedName !==
        nextProps.connector.storage.fullyQualifiedName ||
      prevProps.connector.source.node !== nextProps.connector.source.node ||
      prevProps.connector.source.fields.length !== nextProps.connector.source.fields.length;

    // Also compare children to ensure we re-render if children change
    const childrenChanged = prevProps.children !== nextProps.children;

    return !connectorChanged && !childrenChanged;
  }
);
