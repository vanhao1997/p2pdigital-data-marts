import { BriefcaseBusiness } from 'lucide-react';
import { ExternalPlatformTab } from './ExternalPlatformTab';
import { useTranslation } from 'react-i18next';

export function SubscriptionTab() {
  const { t } = useTranslation();

  return (
    <ExternalPlatformTab
      name='project-subscription'
      title={t('projectSettingsPage.tabs.subscription', 'Subscription')}
      tooltip={t('projectSettingsPage.subscriptionTooltip', 'Project subscription plan')}
      icon={BriefcaseBusiness}
      description={t(
        'projectSettingsPage.subscriptionDescription',
        "We're bringing subscription management into this page soon. In the meantime, view or change your plan on the legacy platform."
      )}
      href='https://platform.p2pdigital.vn/ui/p/none/settings/subscription'
      cta={t('projectSettingsPage.openLegacySubscription', 'Open legacy subscription')}
    />
  );
}
