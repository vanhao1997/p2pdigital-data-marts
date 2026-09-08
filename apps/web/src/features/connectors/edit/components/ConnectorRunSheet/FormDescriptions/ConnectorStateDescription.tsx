import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with an explanation of the Connector State.
 */
export default function ConnectorStateDescription() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='connector-state-details'>
        <AccordionTrigger>{t('connectorRun.stateQuestion')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('connectorRun.stateDescription')}</p>
          <p className='mb-2'>{t('connectorRun.stateIncrementalDescription')}</p>
          <p className='mb-2'>
            {t('destinationHelp.common.moreDetails')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://docs.p2pdigital.io.vn/?utm_source=owox_data_marts&utm_medium=manual_run_sheet&utm_campaign=tooltip_connector_state'
            >
              P2PDigital documentation
            </ExternalAnchor>
            .
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
