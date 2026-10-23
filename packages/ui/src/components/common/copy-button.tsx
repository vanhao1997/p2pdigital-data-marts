import { Copy, Check } from 'lucide-react';

export enum CopyButtonVariant {
  ERROR = 'error',
  DEFAULT = 'default',
}

interface CopyButtonProps {
  text: string;
  section: string;
  variant?: CopyButtonVariant;
  copiedSection: string | null;
  onCopy: (text: string, section: string) => void;
  iconOnly?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  titleLabel?: string;
}

function isViStorageLocale(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage?.getItem('p2p_language');
      return Boolean(stored && stored.startsWith('vi'));
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

export function CopyButton({
  text,
  section,
  variant = CopyButtonVariant.DEFAULT,
  copiedSection,
  onCopy,
  iconOnly = false,
  copyLabel,
  copiedLabel,
  titleLabel,
}: CopyButtonProps) {
  const isError = variant === CopyButtonVariant.ERROR;
  const isCopied = copiedSection === section;
  const isVi = isViStorageLocale();
  const resolvedCopy = copyLabel ?? (isVi ? 'Sao chép' : 'Copy');
  const resolvedCopied = copiedLabel ?? (isVi ? 'Đã sao chép' : 'Copied');
  const resolvedTitle =
    titleLabel ?? (isVi ? `Sao chép ${section} vào bộ nhớ tạm` : `Copy ${section} to clipboard`);

  const baseClasses =
    'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors cursor-pointer';
  const variantClasses = isError
    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
    : 'text-foreground hover:bg-muted';

  return (
    // No use of lib button here, because styles are not applied correctly
    <button
      onClick={e => {
        onCopy(text, section);
        e.stopPropagation();
      }}
      className={`${baseClasses} ${variantClasses}`}
      title={resolvedTitle}
    >
      {iconOnly ? (
        <>{isCopied ? <Check className='h-3 w-3' /> : <Copy className='h-3 w-3' />}</>
      ) : isCopied ? (
        <>
          <Check className='h-3 w-3' />
          {resolvedCopied}
        </>
      ) : (
        <>
          <Copy className='h-3 w-3' />
          {resolvedCopy}
        </>
      )}
    </button>
  );
}
