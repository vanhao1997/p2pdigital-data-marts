'use client';
import { X } from 'lucide-react';
import { cn } from '@owox/ui/lib/utils';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

export type FloatingPopoverPosition =
  | 'center'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-right';

interface FloatingPopoverProps {
  width?: number;
  height?: number;
  position?: FloatingPopoverPosition;
  children: React.ReactNode;
  onClose?: () => void;
  'aria-label'?: string;
}

const positionClasses: Record<FloatingPopoverPosition, string> = {
  center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
};

export function FloatingPopover({
  width = 500,
  height = 500,
  position = 'center',
  children,
  onClose,
  'aria-label': ariaLabel,
}: FloatingPopoverProps) {
  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={cn(
        'fixed z-[999] rounded-t-2xl border bg-white md:rounded-2xl dark:bg-neutral-900',
        'border-neutral-200 dark:border-neutral-800',
        'hover:shadow-3xl transform shadow-2xl transition-all duration-200 ease-out',
        'max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)]',
        positionClasses[position]
      )}
      role='dialog'
      aria-modal='true'
      aria-label={ariaLabel}
      style={{
        width: `min(${width}px, calc(100vw - 2rem))`,
        height: `min(${height}px, calc(100dvh - 2rem))`,
      }}
      data-slot='floating-popover'
    >
      <div className='flex h-full flex-col'>{children}</div>
    </div>
  );
}

/* ───────────────────────────────────────────── */
/* Header */
/* ───────────────────────────────────────────── */

interface FloatingPopoverHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export function FloatingPopoverHeader({ children, onClose, ...props }: FloatingPopoverHeaderProps) {
  const { t } = useTranslation();

  return (
    <div
      className='relative flex items-center justify-between rounded-tl-2xl rounded-tr-2xl border-b bg-neutral-50 px-4 py-3 dark:bg-neutral-800/40'
      data-slot='floating-popover-header'
      {...props}
    >
      {children}
      {onClose && (
        <button
          onClick={onClose}
          className={cn(
            'ml-2 rounded-sm p-1.5 transition-all',
            'text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800',
            'focus:ring-brand-blue-500 focus:ring-2 focus:outline-none active:scale-95'
          )}
          aria-label={t('common.closePopover')}
          data-testid='floatingPopoverClose'
        >
          <X className='size-4' />
        </button>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────── */
/* Title */
/* ───────────────────────────────────────────── */

export function FloatingPopoverTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className='text-md font-semibold' data-slot='floating-popover-title'>
      {children}
    </h2>
  );
}

/* ───────────────────────────────────────────── */
/* Content */
/* ───────────────────────────────────────────── */

export function FloatingPopoverContent({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex-1 space-y-4 overflow-auto px-4 py-3' data-slot='floating-popover-content'>
      {children}
    </div>
  );
}
