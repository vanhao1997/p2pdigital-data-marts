import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { Input } from '@owox/ui/components/input';
import { CopyableField } from '@owox/ui/components/common/copyable-field';
import { Form, FormControl, FormItem, FormLabel, FormLayout } from '@owox/ui/components/form';
import { useProjectRoute } from '../../shared/hooks';
import {
  GoogleOAuthConnectButton,
  destinationOAuthApi,
  type OAuthSettings,
  type OAuthStatus,
} from '../../features/google-oauth';
import { dataDestinationService } from '../../features/data-destination';

const DEFAULT_TITLE = 'Google Sheets';

interface ConnectGoogleSheetsFormValues {
  title: string;
}

export function ConnectGoogleSheetsPage() {
  const { t } = useTranslation();
  const { navigate } = useProjectRoute();
  // The Title field is never pre-filled from the URL — a query param isn't proof of what
  // the user actually wants, so the user always sets the name directly in this form.
  const form = useForm<ConnectGoogleSheetsFormValues>({
    defaultValues: { title: DEFAULT_TITLE },
  });

  const [oauthSettings, setOauthSettings] = useState<OAuthSettings | null>(null);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [oauthEmail, setOauthEmail] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Guards handleSave itself (not just the UI overlay) against a second onSuccess firing
  // while a save is already in flight — the overlay's `pointer-events-none` blocks normal
  // clicks, but this is the actual correctness guarantee against a duplicate create call.
  const savingRef = useRef(false);
  // Dedupes getCredentialStatus calls for the same credentialId: onSuccess fires the
  // credentialId effect below AND handleSave in the same tick, both wanting the same
  // status response — this cache lets them share a single in-flight request.
  const credentialStatusRequests = useRef(new Map<string, Promise<OAuthStatus>>());

  const fetchCredentialStatus = (id: string): Promise<OAuthStatus> => {
    const cached = credentialStatusRequests.current.get(id);
    if (cached) return cached;

    const request = destinationOAuthApi.getCredentialStatus(id);
    credentialStatusRequests.current.set(id, request);
    request.catch(() => credentialStatusRequests.current.delete(id));
    return request;
  };

  useEffect(() => {
    destinationOAuthApi
      .getSettings()
      .then(setOauthSettings)
      .catch((error: unknown) => {
        console.error('Failed to load Google OAuth settings', error);
        setOauthSettings({ available: false });
      });
  }, []);

  useEffect(() => {
    if (!credentialId) {
      setOauthEmail(null);
      return;
    }
    let cancelled = false;
    fetchCredentialStatus(credentialId)
      .then(status => {
        if (!cancelled) setOauthEmail(status.user?.email ?? null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Failed to load the connected Google account', error);
        setOauthEmail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [credentialId]);

  // Fires once per completed OAuth grant (not tied to credentialId state, so reconnecting
  // after a failed save retries it even if the same Google account is reconnected).
  const handleSave = async (connectedCredentialId: string) => {
    if (savingRef.current) return;

    let currentTitle = form.getValues('title').trim();
    if (!currentTitle) {
      setSaveError(t('googleSheetsConnectPage.titleRequired'));
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);

    // Only the untouched default name gets the connected account appended — a title the
    // user typed by hand is used as-is.
    const usedDefaultTitle = currentTitle === DEFAULT_TITLE;
    if (usedDefaultTitle) {
      try {
        const status = await fetchCredentialStatus(connectedCredentialId);
        if (status.user?.email) {
          currentTitle = `${currentTitle} (${status.user.email})`;
        }
      } catch (error) {
        console.error(
          'Failed to resolve the connected Google account for the default title',
          error
        );
      }
    }

    try {
      await dataDestinationService.createConnectGoogleSheetsDestination({
        title: currentTitle,
        credentialId: connectedCredentialId,
      });
    } catch (error) {
      console.error('Failed to create the Google Sheets destination', error);
      setSaveError(
        error instanceof Error ? error.message : t('googleSheetsConnectPage.createFailed')
      );
      setIsSaving(false);
      savingRef.current = false;
      return;
    }

    // The destination now exists — try to close the tab. Browsers silently no-op this for
    // tabs not opened via script, so fall through by navigating to the dedicated confirmation
    // route (not just a local state) — a refresh then lands back on that plain screen instead
    // of this form, which would otherwise risk creating a duplicate destination. No details
    // (like the title) are passed along — an untrusted query param isn't proof of what was
    // actually created, so the confirmation stays deliberately generic.
    window.close();
    navigate('/connect/google-sheets/done', { replace: true });
  };

  if (oauthSettings && !oauthSettings.available) {
    return (
      <div className='bg-card text-card-foreground w-full max-w-lg space-y-4 rounded-lg p-4 shadow-lg'>
        <h1 className='text-lg font-semibold'>{t('googleSheetsConnectPage.title')}</h1>
        <p className='text-muted-foreground text-sm'>
          {t('googleSheetsConnectPage.oauthUnavailable')}
        </p>
      </div>
    );
  }

  return (
    <div className='bg-card text-card-foreground relative w-full max-w-lg overflow-hidden rounded-lg shadow-lg'>
      <Form {...form}>
        <div className={isSaving ? 'pointer-events-none blur-sm' : undefined}>
          <div className='px-4 pt-4'>
            <h1 className='text-lg font-semibold'>{t('googleSheetsConnectPage.title')}</h1>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t('googleSheetsConnectPage.subtitle')}
            </p>
          </div>

          <FormLayout variant='light' className='px-4 py-4'>
            <FormItem>
              <FormLabel tooltip={t('googleSheetsConnectPage.titleHelp')}>
                {t('common.title')}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={DEFAULT_TITLE}
                  disabled={isSaving}
                  {...form.register('title')}
                />
              </FormControl>
            </FormItem>

            <FormItem>
              <FormLabel tooltip={t('googleSheetsConnectPage.oauthHelp')}>
                {t('googleSheetsConnectPage.connectOAuth')}
              </FormLabel>
              <GoogleOAuthConnectButton
                resourceType='destination'
                onSuccess={connectedCredentialId => {
                  setCredentialId(connectedCredentialId);
                  void handleSave(connectedCredentialId);
                }}
                onStatusChange={(isConnected, connectedCredentialId) => {
                  setCredentialId(isConnected ? (connectedCredentialId ?? null) : null);
                }}
              />
              {oauthEmail && (
                <div className='mt-2 flex flex-col gap-1'>
                  <FormLabel>{t('googleSheetsConnectPage.authenticatedEmail')}</FormLabel>
                  <CopyableField value={oauthEmail}>{oauthEmail}</CopyableField>
                </div>
              )}
            </FormItem>

            {saveError && <p className='text-destructive text-sm'>{saveError}</p>}
          </FormLayout>
        </div>
      </Form>

      {isSaving && (
        <div
          data-testid='saving-overlay'
          className='bg-card/60 absolute inset-0 flex items-center justify-center'
        >
          <p className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
            <Loader2 className='h-4 w-4 animate-spin' />
            {t('googleSheetsConnectPage.creating')}
          </p>
        </div>
      )}
    </div>
  );
}
