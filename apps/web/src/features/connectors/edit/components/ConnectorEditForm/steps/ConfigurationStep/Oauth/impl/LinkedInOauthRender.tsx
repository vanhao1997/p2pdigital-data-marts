import { LinkedInLoginButton } from '../../../../../../../shared/components/LinkedInLoginButton/LinkedInLoginButton';
import type { LinkedInLoginResponse } from '../../../../../../../shared/components/LinkedInLoginButton/LinkedInLoginButton';
import type { OauthRenderComponentProps } from '../OauthRenderFactory';
import { useTranslation } from 'react-i18next';

export function LinkedInOauthRender({
  isLoading,
  status,
  settings,
  onOAuthSuccess,
}: Pick<OauthRenderComponentProps, 'isLoading' | 'status' | 'settings' | 'onOAuthSuccess'>) {
  const { t } = useTranslation();
  const handleLinkedInLogin = (response: LinkedInLoginResponse) => {
    void onOAuthSuccess({
      code: response.code,
    });
  };

  return (
    <div className='mt-2 mb-2'>
      <LinkedInLoginButton
        clientId={settings?.vars.ClientId as string}
        redirectUri={settings?.vars.RedirectUri as string}
        scope={(settings?.vars.Scopes as string) || ''}
        onSuccess={handleLinkedInLogin}
        disabled={isLoading}
      >
        {status?.user ? (
          <>
            {t('connectorWizard.oauth.connectedAs')}{' '}
            <strong>{status.user.name ?? status.user.id}</strong>
          </>
        ) : (
          t('connectorWizard.oauth.continueWithLinkedIn')
        )}
      </LinkedInLoginButton>
    </div>
  );
}
