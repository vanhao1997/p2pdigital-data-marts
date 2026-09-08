import { Gem } from 'lucide-react';
import { ExternalPlatformTab } from './ExternalPlatformTab';
import { useTranslation } from 'react-i18next';

export function CreditConsumptionTab() {
  const { t } = useTranslation();

  return (
    <ExternalPlatformTab
      name='project-credit-consumption'
      title={t('projectSettingsPage.tabs.credit', 'Credit consumption')}
      tooltip={t('projectSettingsPage.creditTooltip', 'Project credit usage dashboards')}
      icon={Gem}
      description={t(
        'projectSettingsPage.creditDescription',
        "We're bringing credit consumption dashboards into this page soon. In the meantime, view and manage usage for this project on the legacy platform."
      )}
      href='https://platform.p2pdigital.vn/ui/p/none/settings/consumption'
      cta={t('projectSettingsPage.openLegacyConsumption', 'Open legacy consumption')}
    />
  );
}
