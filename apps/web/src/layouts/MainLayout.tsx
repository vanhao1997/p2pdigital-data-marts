import { useState } from 'react';
import { Outlet } from 'react-router';
import {
  SidebarInset,
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@owox/ui/components/sidebar';
import { AppSidebar } from '../components/AppSidebar';
import { ThemeProvider } from '../app/providers/theme-provider.tsx';
import { storageService } from '../services';
import { GlobalLoader, LoadingProvider, useLoading } from '../shared/components/GlobalLoader';
import { Toaster as SonnerToaster } from '@owox/ui/components/sonner';
import { useUser } from '../features/idp/hooks';
import { ProjectAuthGuards } from './ProjectAuthGuards';
import { Separator } from '@owox/ui/components/separator';
import { ArchiveRestore, Box, DatabaseIcon, LockKeyhole } from 'lucide-react';
import { HelpMenu } from '../components/AppSidebar/HelpMenu';
import { UserMenu } from '../components/AppSidebar/UserMenu';
import { SidebarProjectMenu } from '../components/AppSidebar/ProjectMenu';
import { useTranslation } from 'react-i18next';
import { SkipToContent } from '../shared/components/SkipToContent';

const SIDEBAR_STATE_KEY = 'sidebar_state';
const ignoreSetupChecklist = () => undefined;

function RestrictedProjectSidebar() {
  const { t } = useTranslation();
  const RESTRICTED_NAV_ITEMS = [
    { title: t('sidebar.dataMarts'), icon: Box },
    { title: t('sidebar.storages'), icon: DatabaseIcon },
    { title: t('sidebar.destinations'), icon: ArchiveRestore },
  ];

  return (
    <Sidebar variant='inset' collapsible='icon' data-testid='restricted-project-sidebar'>
      <SidebarHeader>
        <SidebarProjectMenu restricted />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  aria-disabled='true'
                  className='text-muted-foreground hover:text-muted-foreground cursor-default hover:bg-transparent'
                  tooltip={t('sidebar.waitingForAccess')}
                >
                  <LockKeyhole className='size-4 shrink-0' />
                  <span>{t('sidebar.accessRequired')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {RESTRICTED_NAV_ITEMS.map(item => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      aria-disabled='true'
                      className='text-muted-foreground/70 hover:text-muted-foreground/70 cursor-not-allowed hover:bg-transparent'
                      tooltip={t('sidebar.requestAccess')}
                    >
                      <Icon className='size-4 shrink-0' />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <HelpMenu openSetupChecklist={ignoreSetupChecklist} />
        <Separator />
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function MainLayoutContent() {
  const { state, isMobile } = useSidebar();
  const user = useUser();
  const isCollapsed = state === 'collapsed';
  const showTrigger = isMobile || isCollapsed;
  const { isLoading } = useLoading();
  const hasEmptyProjectRoles = Array.isArray(user?.roles) && user.roles.length === 0;

  return (
    <>
      <SonnerToaster position='bottom-right' closeButton />
      <GlobalLoader isLoading={isLoading} />
      <ProjectAuthGuards>
        {user && hasEmptyProjectRoles ? (
          <>
            <RestrictedProjectSidebar />
            <SidebarInset className='min-w-0'>
              {showTrigger && <SidebarTrigger />}
              <Outlet />
            </SidebarInset>
          </>
        ) : (
          <>
            <AppSidebar variant='inset' collapsible='icon' />
            <SidebarInset className='min-w-0'>
              {showTrigger && <SidebarTrigger />}
              <Outlet />
            </SidebarInset>
          </>
        )}
      </ProjectAuthGuards>
    </>
  );
}

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    return storageService.get(SIDEBAR_STATE_KEY, 'boolean') ?? true;
  });

  const handleSidebarChange = (open: boolean) => {
    setSidebarOpen(open);
    storageService.set(SIDEBAR_STATE_KEY, open);
  };

  return (
    <ThemeProvider>
      <SkipToContent />
      <LoadingProvider>
        <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange}>
          <MainLayoutContent />
        </SidebarProvider>
      </LoadingProvider>
    </ThemeProvider>
  );
}

export default MainLayout;
