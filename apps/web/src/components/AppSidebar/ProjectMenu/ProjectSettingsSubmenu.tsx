import { useTranslation } from 'react-i18next';
import {
  BriefcaseBusiness,
  Bell,
  Gem,
  KeyRound,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
} from '@owox/ui/components/dropdown-menu';
import type { MouseEvent } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useFlags } from '../../../app/store/hooks';
import { useProjectId } from '../../../shared/hooks';
import { checkVisible } from '../../../utils';
import { useProjectRoute } from '../../../shared/hooks';

type SettingsSubItem =
  | {
      kind: 'internal';
      titleKey: string;
      defaultTitle: string;
      path: string;
      icon: LucideIcon;
      isVisible?: (isOwoxIdpProvider: boolean, flags: Record<string, unknown> | null) => boolean;
    }
  | {
      kind: 'external';
      titleKey: string;
      defaultTitle: string;
      buildHref: (projectId: string) => string;
      icon: LucideIcon;
      isVisible?: (isOwoxIdpProvider: boolean, flags: Record<string, unknown> | null) => boolean;
    }
  | {
      kind: 'separator';
    };

const PLATFORM_BASE_URL =
  import.meta.env.VITE_OWOX_PLATFORM_URL?.replace(/\/$/, '') ?? 'https://platform.p2pdigital.vn';

const settingsItems: SettingsSubItem[] = [
  {
    kind: 'internal',
    titleKey: 'projectMenu.overview',
    defaultTitle: 'Overview',
    path: '',
    icon: Settings,
  },
  {
    kind: 'internal',
    titleKey: 'projectMenu.members',
    defaultTitle: 'Members',
    path: 'members',
    icon: Users,
  },
  {
    kind: 'internal',
    titleKey: 'projectMenu.contexts',
    defaultTitle: 'Contexts',
    path: 'contexts',
    icon: Tags,
  },
  {
    kind: 'external',
    titleKey: 'projectMenu.creditConsumption',
    defaultTitle: 'Credit consumption',
    buildHref: id => `${PLATFORM_BASE_URL}/ui/p/${id}/settings/consumption`,
    icon: Gem,
    isVisible: isOwoxIdpProvider => isOwoxIdpProvider,
  },
  {
    kind: 'external',
    titleKey: 'projectMenu.subscription',
    defaultTitle: 'Subscription',
    buildHref: id => `${PLATFORM_BASE_URL}/ui/p/${id}/settings/subscription`,
    icon: BriefcaseBusiness,
    isVisible: isOwoxIdpProvider => isOwoxIdpProvider,
  },
  {
    kind: 'internal',
    titleKey: 'projectMenu.licenseKeys',
    defaultTitle: 'License keys',
    path: 'license-keys',
    icon: ShieldCheck,
    isVisible: (_isOwoxIdpProvider, flags) =>
      checkVisible('LICENSE_ISSUANCE_ENABLED', 'true', flags),
  },
  {
    kind: 'internal',
    titleKey: 'projectMenu.notifications',
    defaultTitle: 'Notifications',
    path: 'notifications',
    icon: Bell,
  },
  { kind: 'separator' },
  {
    kind: 'internal',
    titleKey: 'projectMenu.myApiKeys',
    defaultTitle: 'My API Keys',
    path: '/me/api-keys',
    icon: KeyRound,
  },
];

interface ProjectSettingsSubmenuProps {
  onClose: () => void;
}

export function ProjectSettingsSubmenu({ onClose }: ProjectSettingsSubmenuProps) {
  const { flags } = useFlags();
  const { scope } = useProjectRoute();
  const projectId = useProjectId();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isOwoxIdpProvider = checkVisible('IDP_PROVIDER', ['owox-better-auth'], flags);

  const visible = settingsItems.filter(item => {
    if (item.kind === 'separator') return true;
    return item.isVisible?.(isOwoxIdpProvider, flags) ?? true;
  });

  const handleTriggerClick = (event: MouseEvent) => {
    event.preventDefault();
    void navigate(scope('/project-settings'));
    onClose();
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        className='flex cursor-pointer items-center gap-2'
        onClick={handleTriggerClick}
      >
        <Settings className='h-4 w-4' />
        {t('projectMenu.projectSettings', 'Project settings')}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          {visible.map((item, index) => {
            if (item.kind === 'separator') {
              return <DropdownMenuSeparator key={`sep-${String(index)}`} />;
            }
            const Icon = item.icon;
            if (item.kind === 'external') {
              if (!projectId) return null;
              return (
                <DropdownMenuItem asChild key={item.titleKey}>
                  <a
                    href={item.buildHref(projectId)}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-2'
                  >
                    <Icon className='h-4 w-4' />
                    {t(item.titleKey, item.defaultTitle)}
                  </a>
                </DropdownMenuItem>
              );
            }
            const to = item.path.startsWith('/')
              ? scope(item.path)
              : scope(`/project-settings${item.path ? `/${item.path}` : ''}`);
            return (
              <DropdownMenuItem asChild key={item.path || 'overview'}>
                <NavLink to={to} className='flex items-center gap-2'>
                  <Icon className='h-4 w-4' />
                  {t(item.titleKey, item.defaultTitle)}
                </NavLink>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
