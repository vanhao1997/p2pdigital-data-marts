import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@owox/ui/components/dropdown-menu';
import { ProjectSettingsSubmenu } from './ProjectSettingsSubmenu';
import { SwitchProjectMenu } from './SwitchProjectMenu';
import { useProjectMenu } from './useProjectMenu';
import { useProjectRoute } from '../../../shared/hooks';

interface ProjectMenuContentProps {
  onClose?: () => void;
  restricted?: boolean;
}

export function ProjectMenuContent({ onClose, restricted = false }: ProjectMenuContentProps) {
  if (restricted) {
    return <RestrictedProjectMenuContent />;
  }

  return <RegularProjectMenuContent onClose={onClose ?? ignoreMenuClose} />;
}

function RestrictedProjectMenuContent() {
  const { t } = useTranslation();
  return (
    <DropdownMenuContent align='start' side='right' className='w-56'>
      <SwitchProjectMenu
        autoLoad
        emptyMessage={t('projectMenu.noOtherProjects', 'No other projects available')}
        excludeCurrentProject
        showSeparator={false}
      />
    </DropdownMenuContent>
  );
}

const ignoreMenuClose = () => undefined;

function RegularProjectMenuContent({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { visibleMenuItems, canSwitchProject } = useProjectMenu();
  const { scope } = useProjectRoute();

  return (
    <DropdownMenuContent align='start' side='right' className='w-56'>
      {visibleMenuItems.map((item, index) => {
        if (item.type === 'separator') {
          return <DropdownMenuSeparator key={`separator-${String(index)}`} />;
        }

        if (item.type === 'project-settings-submenu') {
          return <ProjectSettingsSubmenu key='project-settings' onClose={onClose} />;
        }

        const Icon = item.icon;

        if (item.internal) {
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link to={scope(item.href)} className='flex items-center gap-2'>
                <Icon className='size-4' />
                {t(item.title, item.title)}
              </Link>
            </DropdownMenuItem>
          );
        }

        return (
          <DropdownMenuItem key={item.href} asChild>
            <a
              href={item.href}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-2'
            >
              <Icon className='size-4' />
              {t(item.title, item.title)}
            </a>
          </DropdownMenuItem>
        );
      })}
      {canSwitchProject && <SwitchProjectMenu key='switch-project' />}
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link to='/projects' className='flex items-center gap-2'>
          {t('projectMenu.manageProjects', 'Manage projects')}
        </Link>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
