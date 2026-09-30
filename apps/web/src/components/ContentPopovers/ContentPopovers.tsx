import {
  FloatingPopover,
  FloatingPopoverContent,
  FloatingPopoverHeader,
  FloatingPopoverTitle,
} from '../../shared/components/FloatingPopover';
import { popoverItems } from './items';
import { useContentPopovers } from '../../app/store/hooks/useContentPopovers';
import type { PopoverConfig } from './types';
import { useTranslation } from 'react-i18next';

export function ContentPopovers() {
  const { activePopoverId, isOpen, close } = useContentPopovers();
  const { t } = useTranslation();

  if (!isOpen || !activePopoverId) return null;

  const config: PopoverConfig = popoverItems[activePopoverId];
  const { width = 500, height = 400, position = 'center', titleKey, content: Content } = config;

  return (
    <>
      <div
        className='fixed inset-0 z-[998] bg-black/20 backdrop-blur-[1px]'
        aria-hidden='true'
        onMouseDown={close}
      />
      <FloatingPopover
        width={width}
        height={height}
        position={position}
        onClose={close}
        aria-label={titleKey ? t(titleKey) : t('contentPopovers.dialogLabel')}
      >
        <FloatingPopoverHeader onClose={close}>
          {titleKey && <FloatingPopoverTitle>{t(titleKey)}</FloatingPopoverTitle>}
        </FloatingPopoverHeader>
        <FloatingPopoverContent>
          <Content onClose={close} />
        </FloatingPopoverContent>
      </FloatingPopover>
    </>
  );
}
