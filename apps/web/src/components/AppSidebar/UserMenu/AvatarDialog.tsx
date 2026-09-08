import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@owox/ui/components/button';
import { Input } from '@owox/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@owox/ui/components/dialog';

export function AvatarDialog({
  avatar,
  onClose,
  onSave,
}: {
  avatar?: string;
  onClose: () => void;
  onSave: (value: string | null) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(avatar ?? '');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function save(next: string | null) {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      await onSave(next);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('userMenu.changeAvatar')}</DialogTitle>
          <DialogDescription>{t('userMenu.avatarUrlPrompt')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={event => {
            event.preventDefault();
            void save(value.trim());
          }}
        >
          <Input
            type='url'
            required
            maxLength={2048}
            aria-label={t('userMenu.avatarUrlPrompt')}
            value={value}
            disabled={pending}
            onChange={event => { setValue(event.target.value); }}
          />
          {value && (
            <img
              key={value}
              src={value}
              referrerPolicy='no-referrer'
              alt={t('userMenu.avatarPreview', 'Avatar preview')}
              className='mt-3 size-16 rounded-full object-cover'
              onError={event => {
                event.currentTarget.hidden = true;
              }}
            />
          )}
          {failed && (
            <p role='alert' className='text-destructive mt-2'>
              {t('userMenu.avatarSaveFailed')}
            </p>
          )}
          <DialogFooter className='mt-4'>
            <Button
              type='button'
              variant='outline'
              disabled={pending || !avatar}
              onClick={() => void save(null)}
            >
              {t('userMenu.removeAvatar')}
            </Button>
            <Button type='submit' disabled={pending}>
              {t(pending ? 'common.saving' : 'common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
