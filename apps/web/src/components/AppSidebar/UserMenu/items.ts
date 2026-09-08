import { LogOut, Monitor, Moon, Sun, Globe, ImagePlus } from 'lucide-react';
import type { UserMenuItem } from './types';
import type { TFunction } from 'i18next';

export const UserMenuItems = ({
  theme,
  setTheme,
  signOut,
  t,
  language,
  changeLanguage,
  updateAvatar,
}: {
  theme: string | undefined;
  setTheme: (theme: string) => void;
  signOut: () => void;
  t: TFunction;
  language: string;
  changeLanguage: (lng: string) => void;
  updateAvatar?: () => void;
}): UserMenuItem[] => [
  ...(updateAvatar
    ? [
        {
          type: 'item',
          title: t('userMenu.changeAvatar', 'Change avatar'),
          icon: ImagePlus,
          onClick: updateAvatar,
        } as UserMenuItem,
      ]
    : []),
  {
    type: 'submenu',
    title: t('userMenu.appearance'),
    icon: getAppearanceIcon(theme),
    submenu: {
      value: theme,
      onChange: (value: string) => {
        setTheme(value);
      },
      options: [
        { value: 'system', label: t('userMenu.system'), icon: Monitor },
        { value: 'light', label: t('userMenu.light'), icon: Sun },
        { value: 'dark', label: t('userMenu.dark'), icon: Moon },
      ],
    },
  },
  {
    type: 'submenu',
    title: t('userMenu.language'),
    icon: Globe,
    submenu: {
      value: language,
      onChange: (value: string) => {
        changeLanguage(value);
      },
      options: [
        { value: 'en', label: 'English' },
        { value: 'vi', label: 'Tiếng Việt' },
      ],
    },
  },
  { type: 'separator' },
  {
    type: 'item',
    title: t('userMenu.signOut'),
    icon: LogOut,
    onClick: signOut,
    className: 'text-red-600 focus:text-red-600',
  },
];

function getAppearanceIcon(theme: string | undefined) {
  switch (theme) {
    case 'light':
      return Sun;
    case 'dark':
      return Moon;
    case 'system':
    default:
      return Monitor;
  }
}
