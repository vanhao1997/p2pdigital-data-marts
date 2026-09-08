import { AccordionItem, AccordionTrigger, AccordionContent } from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export default function SlackDescription() {
  const { t } = useTranslation();
  return (
    <AccordionItem value='slack-details'>
      <AccordionTrigger>{t('destinationHelp.slack.title')}</AccordionTrigger>
      <AccordionContent>
        <p className='mb-2'>
          {t('destinationHelp.slack.setup')} <strong>Slack</strong>{' '}
          {t('destinationHelp.slack.setupAfterSlack')}{' '}
          <strong>{t('destinationHelp.common.destinations')}</strong>{' '}
          {t('destinationHelp.slack.setupEnd')}
        </p>
        <p className='mb-2'>{t('destinationHelp.slack.delivery')}</p>
        <p className='mb-2'>
          {t('destinationHelp.common.moreDetails')}{' '}
          <ExternalAnchor
            className='underline'
            href='https://docs.p2pdigital.io.vn/docs/destinations/supported-destinations/slack/?utm_source=owox_data_marts&utm_medium=destination_entity&utm_campaign=tooltip-slack'
          >
            {t('destinationHelp.common.documentation')}
          </ExternalAnchor>
          .
        </p>
      </AccordionContent>
    </AccordionItem>
  );
}
