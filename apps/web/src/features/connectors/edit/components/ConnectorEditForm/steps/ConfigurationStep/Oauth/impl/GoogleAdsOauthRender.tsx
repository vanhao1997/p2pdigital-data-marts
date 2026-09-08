import { GoogleAdsLoginButton } from '../../../../../../../shared/components/GoogleAdsLoginButton';
import type { GoogleAdsLoginResponse } from '../../../../../../../shared/components/GoogleAdsLoginButton';
import type { OauthRenderComponentProps } from '../OauthRenderFactory';
import { useTranslation } from 'react-i18next';

export function GoogleAdsOauthRender({
  isLoading,
  status,
  settings,
  onOAuthSuccess,
}: OauthRenderComponentProps) {
  const { t } = useTranslation();
  const handleGoogleAdsLogin = (response: GoogleAdsLoginResponse) => {
    void onOAuthSuccess({ code: response.code });
  };

  return (
    <div className='mt-2 mb-2 space-y-4'>
      <GoogleAdsLoginButton
        clientId={settings?.vars.ClientId as string}
        redirectUri={settings?.vars.RedirectUri as string}
        onSuccess={handleGoogleAdsLogin}
        disabled={isLoading}
      >
        {status?.user ? (
          <>
            {t('connectorWizard.oauth.connectedAs')}{' '}
            <strong>{status.user.name ?? status.user.id}</strong>
          </>
        ) : (
          t('connectorWizard.oauth.signInWithGoogle')
        )}
      </GoogleAdsLoginButton>
    </div>
  );
}
