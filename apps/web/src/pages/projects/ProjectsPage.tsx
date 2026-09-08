import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@owox/ui/components/button';
import { Input } from '@owox/ui/components/input';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../../features/idp/hooks/useProjects';
import { buildProjectPath } from '../../utils/path';
import { useFlags } from '../../app/store/hooks';
import { checkVisible } from '../../utils/check-visible';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { flags } = useFlags();
  const { t } = useTranslation();
  const {
    projects,
    isLoading,
    error,
    reload,
    createProject,
    renameProject,
    archiveProject,
    unarchiveProject,
    selectProject,
  } = useProjects();
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const canManageProjects = checkVisible('IDP_PROVIDER', 'better-auth', flags);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate() {
    try {
      const project = await createProject(name);
      setName('');
      setMessage(null);
      await selectProject(project.id);
      void navigate(buildProjectPath(project.id, '/data-marts'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('projectsPage.createFailed'));
    }
  }

  async function handleRename(projectId: string) {
    const title = window.prompt(
      t('projectsPage.newProjectName'),
      projects.find(p => p.id === projectId)?.title ?? ''
    );
    if (title == null) return;
    try {
      await renameProject(projectId, title);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('projectsPage.renameFailed'));
    }
  }

  async function handleSelect(projectId: string) {
    try {
      if (canManageProjects) await selectProject(projectId);
      window.location.assign(buildProjectPath(projectId, '/data-marts'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('projectsPage.selectFailed'));
    }
  }

  return (
    <main className='mx-auto max-w-3xl p-8'>
      <h1 className='mb-2 text-2xl font-semibold'>{t('projectsPage.title')}</h1>
      <p className='text-muted-foreground mb-6 text-sm'>{t('projectsPage.subtitle')}</p>
      {canManageProjects ? (
        <div className='mb-8 flex gap-2'>
          <Input
            value={name}
            onChange={e => {
              setName(e.target.value);
            }}
            placeholder={t('projectsPage.newProjectName')}
            maxLength={100}
          />
          <Button onClick={() => void handleCreate()} disabled={!name.trim() || isLoading}>
            {t('projectsPage.create')}
          </Button>
        </div>
      ) : (
        <p className='text-muted-foreground mb-8 text-sm'>
          {t('projectsPage.managementUnavailable')}
        </p>
      )}
      {message && <p className='text-destructive mb-4 text-sm'>{message}</p>}
      {error && <p className='text-destructive mb-4 text-sm'>{error.message}</p>}
      <div className='space-y-3'>
        {projects.map(project => (
          <section
            key={project.id}
            className='flex items-center justify-between rounded-lg border p-4'
          >
            <div>
              <div className='font-medium'>{project.title}</div>
              <div className='text-muted-foreground text-xs'>
                {project.archived
                  ? t('projectsPage.archivedReadOnly')
                  : project.id === '0'
                    ? t('projectsPage.defaultProject')
                    : t('projectsPage.active')}
              </div>
            </div>
            <div className='flex gap-2'>
              {canManageProjects &&
                (project.archived ? (
                  <Button variant='outline' onClick={() => void unarchiveProject(project.id)}>
                    {t('projectsPage.unarchive')}
                  </Button>
                ) : (
                  <Button variant='outline' onClick={() => void archiveProject(project.id)}>
                    {t('projectsPage.archive')}
                  </Button>
                ))}
              {canManageProjects && (
                <Button
                  variant='outline'
                  onClick={() => {
                    void handleRename(project.id);
                  }}
                >
                  {t('projectsPage.rename')}
                </Button>
              )}
              <Button onClick={() => void handleSelect(project.id)}>
                {t('projectsPage.open')}
              </Button>
            </div>
          </section>
        ))}
      </div>
      {!projects.length && !isLoading && (
        <p className='text-muted-foreground text-sm'>{t('projectsPage.noProjectsYet')}</p>
      )}
    </main>
  );
}
