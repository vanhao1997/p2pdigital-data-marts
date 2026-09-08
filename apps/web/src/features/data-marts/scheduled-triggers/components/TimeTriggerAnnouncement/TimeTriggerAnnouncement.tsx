import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function TimeTriggerAnnouncement() {
  const { t } = useTranslation();
  return (
    <div className='dm-card-block !gap-1.5 !py-3'>
      <div className='text-foreground flex items-start gap-1.5 text-sm'>
        <CalendarClock className='h-5 w-5 shrink-0' aria-hidden='true' />
        <div>
          <p className='font-medium'>{t('timeTriggerAnnouncement.title', 'Time Triggers')}</p>
          <p className='text-muted-foreground'>
            {t(
              'timeTriggerAnnouncement.description',
              'Set up automatic runs in the Triggers tab once you’ve saved and published this Data Mart.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
