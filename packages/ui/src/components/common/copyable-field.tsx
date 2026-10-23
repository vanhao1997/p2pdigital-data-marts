import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@owox/ui/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@owox/ui/components/tooltip';

interface CopyableFieldProps {
  value: string;
  children?: React.ReactNode;
  doNotTruncateContent?: boolean;
  className?: string;
  emptyText?: string;
  copyText?: string;
  copiedText?: string;
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

export function CopyableField({
  value,
  children,
  doNotTruncateContent,
  className,
  emptyText,
  copyText,
  copiedText,
}: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);
  const isVi = isViStorageLocale();
  const resolvedEmpty = emptyText ?? (isVi ? 'Không có dữ liệu' : 'No data');
  const resolvedCopy = copyText ?? (isVi ? 'Nhấn để sao chép' : 'Click to copy');
  const resolvedCopied = copiedText ?? (isVi ? 'Đã sao chép!' : 'Copied!');

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role='button'
            tabIndex={0}
            onClick={handleCopy}
            onKeyDown={e => e.key === 'Enter' && handleCopy()}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-2 select-none',
              'text-muted-foreground border-input rounded-md border px-3 py-1.5 text-sm',
              'hover:bg-accent hover:text-accent-foreground transition-colors',
              className
            )}
          >
            <span className={doNotTruncateContent ? 'w-[95%]' : 'truncate'}>
              {children || value || resolvedEmpty}
            </span>
            {copied ? <Check className='h-4 w-4 text-green-500' /> : <Copy className='h-4 w-4' />}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? resolvedCopied : resolvedCopy}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
