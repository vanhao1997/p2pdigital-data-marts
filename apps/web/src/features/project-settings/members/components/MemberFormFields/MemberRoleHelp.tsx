import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { useTranslation } from 'react-i18next';

export function RoleHelpAccordion() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='member-role-help'>
        <AccordionTrigger>{t('membersPage.roleHelp.question')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>
            <strong>{t('requestAccessPage.roles.viewer')}</strong> —{' '}
            {t('membersPage.roleHelp.businessUser')}
          </p>
          <p className='mb-2'>
            <strong>{t('requestAccessPage.roles.editor')}</strong> —{' '}
            {t('membersPage.roleHelp.technicalUser')}
          </p>
          <p className='mb-2'>
            <strong>{t('requestAccessPage.roles.admin')}</strong> —{' '}
            {t('membersPage.roleHelp.projectAdmin')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function ScopeHelpAccordion() {
  const { t } = useTranslation();

  return (
    <Accordion variant='common' type='single' collapsible>
      <AccordionItem value='member-scope-help'>
        <AccordionTrigger>{t('membersPage.scopeHelp.question')}</AccordionTrigger>
        <AccordionContent>
          <p className='mb-2'>
            <strong>{t('membersPage.entireProject')}</strong> —{' '}
            {t('membersPage.scopeHelp.entireProject')}
          </p>
          <p className='mb-2'>
            <strong>{t('membersPage.scopeHelp.selectedContextsLabel')}</strong> —{' '}
            {t('membersPage.scopeHelp.selectedContexts')}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
