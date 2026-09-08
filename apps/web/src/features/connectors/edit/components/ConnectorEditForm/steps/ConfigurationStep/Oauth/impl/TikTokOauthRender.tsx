import { TikTokLoginButton } from '../../../../../../../shared/components/TikTokLoginButton';
import type { TikTokLoginResponse } from '../../../../../../../shared/components/TikTokLoginButton';
import type { OauthRenderComponentProps } from '../OauthRenderFactory';
import { useTranslation } from 'react-i18next';

export function TikTokOauthRender({
  isLoading,
  status,
  settings,
  onOAuthSuccess,
}: Pick<OauthRenderComponentProps, 'isLoading' | 'status' | 'settings' | 'onOAuthSuccess'>) {
  const { t } = useTranslation();
  const handleTikTokLogin = (response: TikTokLoginResponse) => {
    void onOAuthSuccess({
      authCode: response.authCode,
    });
  };

  return (
    <div className='mt-2 mb-2'>
      <TikTokLoginButton
        appId={settings?.vars.AppId as string}
        redirectUri={settings?.vars.RedirectUri as string}
        onSuccess={handleTikTokLogin}
        disabled={isLoading}
      >
        {status?.user ? (
          <>
            {t('connectorWizard.oauth.authenticatedAs')}{' '}
            <strong>{status.user.name ?? status.user.id}</strong>
          </>
        ) : (
          t('connectorWizard.oauth.continueWithTikTok')
        )}
      </TikTokLoginButton>
    </div>
  );
}
