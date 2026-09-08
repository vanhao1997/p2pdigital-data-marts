import type { ConnectorFieldsResponseApiDto } from '../../../../shared/api/';
import {
  AppWizardStepSection,
  AppWizardStep,
  AppWizardStepCardItem,
  AppWizardStepHero,
  AppWizardStepLoading,
  AppWizardStepCards,
} from '@owox/ui/components/common/wizard';
import { OpenIssueLink } from '../components';
import { StepperHeroBlock } from '../components';
import type { ConnectorListItem } from '../../../../shared/model/types/connector';
import { ChevronRight, Unplug } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { localizeConnectorNode } from '../../../../shared/utils/connector-metadata';

interface NodesSelectionStepProps {
  connector: ConnectorListItem;
  connectorFields: ConnectorFieldsResponseApiDto[] | null;
  selectedField: string;
  connectorName?: string;
  loading?: boolean;
  onFieldSelect: (fieldName: string) => void;
}

export function NodesSelectionStep({
  connector,
  connectorFields,
  selectedField,
  connectorName,
  loading = false,
  onFieldSelect,
}: NodesSelectionStepProps) {
  const { t } = useTranslation();
  const title = connectorName
    ? t('connectorWizard.selectDataFor', { connector: connectorName })
    : t('connectorWizard.selectData');

  if (loading) {
    return <AppWizardStepLoading variant='list' />;
  }

  if (!connectorFields || connectorFields.length === 0) {
    return (
      <AppWizardStep>
        <StepperHeroBlock connector={connector} />
        <AppWizardStepHero
          icon={<Unplug size={56} strokeWidth={1} />}
          title={
            connectorName
              ? t('connectorWizard.noNodesFor', { connector: connectorName })
              : t('connectorWizard.noNodes')
          }
          subtitle={t('connectorWizard.connectorIncomplete')}
        />
        <OpenIssueLink label={t('connectorWizard.missingData')} />
      </AppWizardStep>
    );
  }

  return (
    <AppWizardStep>
      <StepperHeroBlock connector={connector} />
      <AppWizardStepSection title={title}>
        <AppWizardStepCards>
          {connectorFields.map(rawField => {
            const field = localizeConnectorNode(rawField);
            return (
              <AppWizardStepCardItem
                key={field.name}
                type='radio'
                id={field.name}
                name='selectedField'
                value={field.name}
                label={field.overview ?? field.name}
                subtitle={field.description}
                checked={selectedField === field.name}
                onChange={value => {
                  onFieldSelect(value as string);
                }}
                tooltip={
                  field.name && (
                    <div className='flex flex-col gap-2 py-1'>
                      <p>
                        <span className='font-semibold'>{t('connectorWizard.tableName')}:</span>{' '}
                        {field.destinationName ?? field.name}
                      </p>
                      {field.description && (
                        <p>
                          <span className='font-semibold'>{t('connectorWizard.description')}:</span>{' '}
                          {field.description}
                        </p>
                      )}
                      {field.documentation && (
                        <Link
                          to={field.documentation}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='bg-muted/16 hover:bg-muted/20 dark:bg-muted/8 dark:hover:bg-muted/16 flex items-center justify-center gap-1 rounded-sm px-2 py-1 font-semibold'
                        >
                          {t('connectorWizard.readMore')}
                          <ChevronRight className='h-3 w-3' />
                        </Link>
                      )}
                    </div>
                  )
                }
                selected={selectedField === field.name}
              />
            );
          })}
        </AppWizardStepCards>

        <OpenIssueLink label={t('connectorWizard.missingData')} />
      </AppWizardStepSection>
    </AppWizardStep>
  );
}
