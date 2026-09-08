import { FacebookLoginButton } from '../../../../../../../shared/components/FacebookLoginButton';
import { useTranslation } from 'react-i18next';
import type { FacebookLoginResponse } from '../../../../../../../shared/components/FacebookLoginButton';
import type { OauthRenderComponentProps } from '../OauthRenderFactory';

export function FacebookOauthRender({
  isLoading,
  status,
  settings,
  onOAuthSuccess,
}: Pick<OauthRenderComponentProps, 'isLoading' | 'status' | 'settings' | 'onOAuthSuccess'>) {
  const { t } = useTranslation();
  const handleFacebookLogin = (response: FacebookLoginResponse) => {
    void onOAuthSuccess({
      accessToken: response.accessToken,
    });
  };

  return (
    <div className='mt-2 mb-2'>
      <FacebookLoginButton
        appId={settings?.vars.AppId as string}
        scope={settings?.vars.Scopes as string}
        onSuccess={handleFacebookLogin}
        disabled={isLoading}
      >
        {status?.user ? (
          <>
            {t('facebookAuth.authenticatedAs')}{' '}
            <strong>{status.user.name ?? status.user.id}</strong>
          </>
        ) : (
          t('facebookAuth.continue')
        )}
      </FacebookLoginButton>
    </div>
  );
}
