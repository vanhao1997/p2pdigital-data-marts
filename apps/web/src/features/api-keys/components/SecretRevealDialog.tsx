import { SecretRevealDialog as RevealDialog } from '../../../shared/components/SecretRevealDialog/SecretRevealDialog';
import type { CreateProjectMemberApiKeyResponse } from '../types';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { buildDocsUrl, resolveDocsLocale } from '../../../shared/utils/docs-links';

interface SecretRevealDialogProps {
  data: CreateProjectMemberApiKeyResponse | null;
  onDone: () => void;
}

export function SecretRevealDialog({ data, onDone }: SecretRevealDialogProps) {
  const { t } = useTranslation();
  if (!data) return null;

  return (
    <RevealDialog
      title={t('apiKeysPage.reveal.title')}
      description={t('apiKeysPage.reveal.description')}
      label={t('apiKeysPage.reveal.label')}
      labelTooltip={t('apiKeysPage.reveal.labelTooltip')}
      secret={data.apiKey}
      notice={t('apiKeysPage.reveal.notice')}
      confirmLabel={t('apiKeysPage.reveal.confirm')}
      docsLink={{
        href: buildDocsUrl('api/api-keys', resolveDocsLocale(i18n.language), 'api_key_reveal'),
        label: t('apiKeysPage.reveal.docs'),
      }}
      onDone={onDone}
    />
  );
}
