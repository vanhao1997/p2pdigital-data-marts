import { FormSection } from '@owox/ui/components/form';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@owox/ui/components/accordion';
import { RecipientsSelector } from './RecipientsSelector';
import { FieldItem, FieldLabel, FieldDescription } from '../form/FormField';
import type { ProjectMember } from '../../../types';
import { ExternalAnchor } from '@owox/ui/components/common/external-anchor';
import { useTranslation } from 'react-i18next';

interface RecipientsSectionProps {
  members: ProjectMember[];
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function RecipientsSection({
  members,
  selectedUserIds,
  onChange,
  isLoading,
  disabled,
}: RecipientsSectionProps) {
  const { t } = useTranslation();
  return (
    <FormSection title={t('notificationsPage.recipients', 'Recipients')}>
      <FieldItem>
        <FieldLabel
          tooltip={t(
            'notificationsPage.recipientsTooltip',
            'Select team members who should receive notifications'
          )}
        >
          {t('notificationsPage.teamMembers', 'Team members')}
        </FieldLabel>
        <RecipientsSelector
          members={members}
          selectedUserIds={selectedUserIds}
          onChange={onChange}
          isLoading={isLoading}
          disabled={disabled}
        />
        <FieldDescription>
          <Accordion variant='common' type='single' collapsible>
            <AccordionItem value='recipients-info'>
              <AccordionTrigger>
                {t(
                  'notificationsPage.addRecipientsQuestion',
                  'How to add new recipients to this notification?'
                )}
              </AccordionTrigger>
              <AccordionContent>
                <p className='mb-2'>
                  {t(
                    'notificationsPage.addRecipientsDescription',
                    'Only project members can receive notifications. To add new recipients, first invite them to the project through'
                  )}{' '}
                  <ExternalAnchor href='https://platform.p2pdigital.vn/ui/p/none/settings/members'>
                    {t('notificationsPage.projectSettingsMembers', 'Project Settings → Members')}
                  </ExternalAnchor>{' '}
                  {` ${t('notificationsPage.page', 'page')}.`}
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </FieldDescription>
      </FieldItem>
    </FormSection>
  );
}
