import { MicrosoftLoginButton } from '../../../../../../../shared/components/MicrosoftLoginButton';
import type { MicrosoftLoginResponse } from '../../../../../../../shared/components/MicrosoftLoginButton';
import type { OauthRenderComponentProps } from '../OauthRenderFactory';
import { useTranslation } from 'react-i18next';

export function MicrosoftOauthRender({
  isLoading,
  status,
  settings,
  onOAuthSuccess,
}: Pick<OauthRenderComponentProps, 'isLoading' | 'status' | 'settings' | 'onOAuthSuccess'>) {
  const { t } = useTranslation();
  const handleMicrosoftLogin = (response: MicrosoftLoginResponse) => {
    void onOAuthSuccess({
      code: response.code,
    });
  };

  return (
    <div className='mt-2 mb-2'>
      <MicrosoftLoginButton
        clientId={settings?.vars.ClientId as string}
        redirectUri={settings?.vars.RedirectUri as string}
        onSuccess={handleMicrosoftLogin}
        disabled={isLoading}
      >
        {status?.user ? (
          <>
            {t('connectorWizard.oauth.connectedAs')}{' '}
            <strong>{status.user.name ?? status.user.id}</strong>
          </>
        ) : (
          t('connectorWizard.oauth.signInWithMicrosoft')
        )}
      </MicrosoftLoginButton>
    </div>
  );
}
