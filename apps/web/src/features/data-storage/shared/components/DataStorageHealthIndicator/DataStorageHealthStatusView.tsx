import { CircleCheck, CircleDashed, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataStorageHealthStatus } from '../../services/data-storage-health-status.service';
import { sanitizeErrorDiagnostic } from '../../../../../shared/utils/sanitize-error-diagnostic';

interface Props {
  status: DataStorageHealthStatus;
  errorMessage?: string;
  isLoading?: boolean;
}

export function DataStorageHealthStatusView({ status, errorMessage, isLoading }: Props) {
  const { t } = useTranslation();
  const diagnostic = sanitizeErrorDiagnostic(errorMessage);
  if (isLoading) {
    return (
      <div className='text-muted-foreground flex animate-pulse items-center gap-2 text-sm'>
        <CircleDashed className='size-4' />
        <span>{t('storageHealth.validating')}</span>
      </div>
    );
  }

  if (status === DataStorageHealthStatus.VALID) {
    return (
      <div className='flex items-center gap-2 text-sm text-green-500'>
        <CircleCheck className='size-4' />
        <span>{t('storageHealth.valid')}</span>
      </div>
    );
  }

  if (status === DataStorageHealthStatus.UNCONFIGURED) {
    return (
      <div className='text-muted-foreground flex items-center gap-2 text-sm'>
        <CircleDashed className='size-4' />
        <span>{t('storageHealth.unconfigured')}</span>
      </div>
    );
  }

  if (status === DataStorageHealthStatus.REAUTH_REQUIRED) {
    return (
      <div className='flex items-start gap-2 text-sm text-red-500'>
        <TriangleAlert className='mt-0.5 size-4 shrink-0' />
        <span className='flex min-w-0 flex-col'>
          <span>{t('storageHealth.reauthRequired')}</span>
          {diagnostic && <span className='text-muted-foreground text-xs'>{diagnostic}</span>}
        </span>
      </div>
    );
  }

  return (
    <div className='flex items-start gap-2 text-sm text-red-500'>
      <TriangleAlert className='mt-0.5 size-4 shrink-0' />
      <span className='flex min-w-0 flex-col'>
        <span>{t('storageHealth.invalid')}</span>
        {diagnostic && <span className='text-muted-foreground text-xs'>{diagnostic}</span>}
      </span>
    </div>
  );
}
