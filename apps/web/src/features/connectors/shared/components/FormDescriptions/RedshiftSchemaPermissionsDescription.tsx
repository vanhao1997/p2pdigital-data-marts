import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

/**
 * Accordion with information about granting permissions for schema creation in Redshift.
 */
export default function RedshiftSchemaPermissionsDescription() {
  const { t } = useTranslation();
  return (
    <Accordion variant='common' type='single' collapsible className='text-sm'>
      <AccordionItem value='redshift-schema-permissions'>
        <AccordionTrigger className='text-sm'>
          {t('connectorHelp.redshiftSchema.title')}
        </AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>{t('connectorHelp.redshiftSchema.intro')}</p>
          <p className='mb-2 text-sm font-medium'>{t('connectorHelp.redshiftSchema.grant')}</p>
          <pre className='bg-muted overflow-x-auto rounded p-2 text-xs'>
            <code>
              GRANT CREATE ON DATABASE &lt;DATABASE_NAME&gt; TO "IAM:&lt;USERNAME_IN_IAM&gt;";
            </code>
          </pre>
          <p className='text-muted-foreground mt-2 text-sm'>
            {t('connectorHelp.redshiftSchema.replacePrefix')}{' '}
            <code className='bg-muted rounded px-1 py-0.5'>&lt;DATABASE_NAME&gt;</code>{' '}
            {t('connectorHelp.redshiftSchema.replaceMiddle')}{' '}
            <code className='bg-muted rounded px-1 py-0.5'>&lt;USERNAME_IN_IAM&gt;</code>{' '}
            {t('connectorHelp.redshiftSchema.replaceSuffix')}
          </p>
          <p className='mt-2 text-sm'>
            {t('connectorHelp.redshiftSchema.findPrefix')}{' '}
            <ExternalAnchor className='underline' href='https://console.aws.amazon.com/iam/'>
              {t('connectorHelp.redshiftSchema.console')}
            </ExternalAnchor>{' '}
            {t('connectorHelp.redshiftSchema.usersSuffix')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
