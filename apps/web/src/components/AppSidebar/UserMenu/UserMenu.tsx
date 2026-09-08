import { useState } from 'react';
import { DropdownMenu } from '@owox/ui/components/dropdown-menu';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../features/idp/hooks';
import { generateInitials } from '../../../shared/utils';
import { UserMenuItems } from './items';
import { UserMenuTrigger } from './UserMenuTrigger';
import { UserMenuContent } from './UserMenuContent';
import { LANGUAGE_STORAGE_KEY } from '../../../i18n';
import { useFlags } from '../../../app/store/hooks';
import { AvatarDialog } from './AvatarDialog';

export function UserMenu() {
  const { user, signOut, updateAvatar } = useAuth();
  const { setTheme, theme } = useTheme();
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const { flags } = useFlags();

  if (!user) return null;

  const { fullName, email, avatar } = user;
  const displayName = fullName ?? email ?? 'Unknown User';
  const initials = generateInitials(fullName, email);

  const activeLanguage = String(i18n.resolvedLanguage).startsWith('vi') ? 'vi' : 'en';

  const changeLanguage = (lng: string) => {
    void i18n.changeLanguage(lng);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    } catch {
      // ignore
    }
  };

  const changeAvatar = () => {
    setIsOpen(false);
    setAvatarOpen(true);
  };

  return (
    <div
      data-slot='sidebar-menu-item'
      data-sidebar='menu-item'
      className='group/menu-item relative'
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <UserMenuTrigger
          isOpen={isOpen}
          displayName={displayName}
          email={email}
          avatar={avatar}
          initials={initials}
        />
        <UserMenuContent
          items={UserMenuItems({
            theme,
            setTheme,
            signOut,
            t,
            language: activeLanguage,
            changeLanguage,
            updateAvatar:
              flags?.IDP_PROVIDER === 'better-auth' && !user.viewOnly ? changeAvatar : undefined,
          })}
        />
      </DropdownMenu>
      {avatarOpen && (
        <AvatarDialog avatar={avatar} onClose={() => { setAvatarOpen(false); }} onSave={updateAvatar} />
      )}
    </div>
  );
}
