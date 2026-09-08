import { TemplateSourceTypeEnum } from '../../../../shared';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

export interface MessageTemplateDescriptionProps {
  type: TemplateSourceTypeEnum;
}

export default function MessageTemplateDescription({ type }: MessageTemplateDescriptionProps) {
  const { t } = useTranslation();

  if (type === TemplateSourceTypeEnum.INSIGHT_TEMPLATE) {
    return (
      <Accordion variant='common' type='single' collapsible>
        <AccordionItem value='insight-template-details' className='border-none'>
          <AccordionTrigger>{t('reportsUi.messageTemplateInsightHelpTitle')}</AccordionTrigger>
          <AccordionContent className='text-muted-foreground'>
            <p>{t('reportsUi.messageTemplateInsightHelpDescription')}</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <Accordion variant='common' type='single' collapsible className='space-y-1'>
      <AccordionItem value='message-details' className='border-none'>
        <AccordionTrigger>{t('reportsUi.messageTemplateMarkdownHelpTitle')}</AccordionTrigger>
        <AccordionContent className='text-muted-foreground'>
          <p className='mb-2'>{t('reportsUi.messageTemplateMarkdownHelpIntro')}</p>
          <p className='mb-2'>
            {t('reportsUi.messageTemplateMarkdownHelpExample')}
            <br />
            {t('reportsUi.messageTemplateMarkdownHelpBold')}
            <br />
            {t('reportsUi.messageTemplateMarkdownHelpItalic')}
            <br />
            {t('reportsUi.messageTemplateMarkdownHelpList')}
          </p>
          <p>
            {t('reportsUi.messageTemplateMarkdownHelpPreview')}
            <br />
            {t('reportsUi.messageTemplateMarkdownHelpGuide')}{' '}
            <ExternalAnchor
              className='underline'
              href='https://www.markdownguide.org/basic-syntax/'
            >
              {t('reportsUi.messageTemplateMarkdownHelpGuideLink')}
            </ExternalAnchor>
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value='data-table-details' className='border-none'>
        <AccordionTrigger>{t('reportsUi.messageTemplateDataHelpTitle')}</AccordionTrigger>
        <AccordionContent className='text-muted-foreground'>
          <p className='mb-2'>
            {t('reportsUi.messageTemplateDataHelpIntroPrefix')} <code>{'{{table}}'}</code>{' '}
            {t('reportsUi.messageTemplateDataHelpIntroSuffix')}
          </p>
          <p className='mb-2'>
            {t('reportsUi.messageTemplateDataHelpParameters')}
            <br />
            {t('reportsUi.messageTemplateDataHelpLimit')}
            <br />
            {t('reportsUi.messageTemplateDataHelpColumns')} <code>{'columns="id, revenue"'}</code>
          </p>
          <p className='mb-2'>
            {t('reportsUi.messageTemplateDataHelpExample')}
            <br />
            <code>{'{{table limit=20 columns="id, revenue"}}'}</code>
          </p>
          <p className='mb-2'>
            {t('reportsUi.messageTemplateDataHelpHeadersCountPrefix')}{' '}
            <code>{'{{dataHeadersCount}}'}</code>{' '}
            {t('reportsUi.messageTemplateDataHelpHeadersCountSuffix')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
