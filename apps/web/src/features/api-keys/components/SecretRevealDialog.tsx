import { SecretRevealDialog as RevealDialog } from '../../../shared/components/SecretRevealDialog/SecretRevealDialog';
import type { CreateProjectMemberApiKeyResponse } from '../types';
import { useTranslation } from 'react-i18next';

const API_KEYS_DOCS_URL = 'https://docs.p2pdigital.io.vn/docs/api/api-keys/';

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
      docsLink={{ href: API_KEYS_DOCS_URL, label: t('apiKeysPage.reveal.docs') }}
      onDone={onDone}
    />
  );
}
