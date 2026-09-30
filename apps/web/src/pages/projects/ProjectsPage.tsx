import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@owox/ui/components/button';
import { Input } from '@owox/ui/components/input';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../../features/idp/hooks/useProjects';
import { buildProjectPath } from '../../utils/path';
import { useFlags } from '../../app/store/hooks';
import { checkVisible } from '../../utils/check-visible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@owox/ui/components/dialog';

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
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const canManageProjects = checkVisible('IDP_PROVIDER', 'better-auth', flags);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate() {
    setPendingAction('create');
    try {
      const project = await createProject(name);
      setName('');
      setMessage(null);
      toast.success(t('projectsPage.created'));
      await selectProject(project.id);
      void navigate(buildProjectPath(project.id, '/data-marts'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('projectsPage.createFailed'));
    } finally {
      setPendingAction(null);
    }
  }

  function handleRename(projectId: string) {
    setRenameProjectId(projectId);
    setRenameTitle(projects.find(p => p.id === projectId)?.title ?? '');
    setRenameError(null);
  }

  async function submitRename() {
    if (renameProjectId === null) return;
    setPendingAction('rename');
    try {
      await renameProject(renameProjectId, renameTitle);
      setRenameProjectId(null);
      toast.success(t('projectsPage.renamed'));
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : t('projectsPage.renameFailed'));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleArchive(projectId: string, archived: boolean) {
    setPendingAction(`${archived ? 'unarchive' : 'archive'}:${projectId}`);
    try {
      if (archived) {
        await unarchiveProject(projectId);
      } else {
        await archiveProject(projectId);
      }
      toast.success(t(archived ? 'projectsPage.unarchived' : 'projectsPage.archived'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('projectsPage.updateFailed'));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSelect(projectId: string) {
    setPendingAction(`select:${projectId}`);
    try {
      if (canManageProjects) await selectProject(projectId);
      void navigate(buildProjectPath(projectId, '/data-marts'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('projectsPage.selectFailed'));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className='mx-auto max-w-3xl p-4 sm:p-8'>
      <h1 className='mb-2 text-2xl font-semibold'>{t('projectsPage.title')}</h1>
      <p className='text-muted-foreground mb-6 text-sm'>{t('projectsPage.subtitle')}</p>
      {canManageProjects ? (
        <div className='mb-8 flex flex-col gap-2 sm:flex-row'>
          <Input
            value={name}
            onChange={e => {
              setName(e.target.value);
            }}
            placeholder={t('projectsPage.newProjectName')}
            maxLength={100}
          />
          <Button
            onClick={() => void handleCreate()}
            disabled={!name.trim() || isLoading || pendingAction !== null}
          >
            {pendingAction === 'create' ? t('projectsPage.creating') : t('projectsPage.create')}
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
            className='flex flex-col items-stretch justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-center'
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
            <div className='flex flex-wrap gap-2'>
              {canManageProjects &&
                (project.archived ? (
                  <Button
                    variant='outline'
                    onClick={() => void handleArchive(project.id, true)}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction === `unarchive:${project.id}`
                      ? t('projectsPage.saving')
                      : t('projectsPage.unarchive')}
                  </Button>
                ) : (
                  <Button
                    variant='outline'
                    onClick={() => void handleArchive(project.id, false)}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction === `archive:${project.id}`
                      ? t('projectsPage.saving')
                      : t('projectsPage.archive')}
                  </Button>
                ))}
              {canManageProjects && (
                <Button
                  variant='outline'
                  onClick={() => {
                    handleRename(project.id);
                  }}
                  disabled={pendingAction !== null}
                >
                  {t('projectsPage.rename')}
                </Button>
              )}
              <Button
                onClick={() => void handleSelect(project.id)}
                disabled={pendingAction !== null}
              >
                {pendingAction === `select:${project.id}`
                  ? t('projectsPage.loading')
                  : t('projectsPage.open')}
              </Button>
            </div>
          </section>
        ))}
      </div>
      {!projects.length && !isLoading && (
        <p className='text-muted-foreground text-sm'>{t('projectsPage.noProjectsYet')}</p>
      )}
      <Dialog
        open={renameProjectId !== null}
        onOpenChange={open => {
          if (!open) setRenameProjectId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('projectsPage.rename')}</DialogTitle>
            <DialogDescription>{t('projectsPage.newProjectName')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={event => {
              event.preventDefault();
              void submitRename();
            }}
            className='flex flex-col gap-4'
          >
            <Input
              autoFocus
              aria-label={t('projectsPage.newProjectName')}
              value={renameTitle}
              onChange={event => setRenameTitle(event.target.value)}
              maxLength={100}
            />
            {renameError && (
              <p className='text-destructive text-sm' role='alert'>
                {renameError}
              </p>
            )}
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setRenameProjectId(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type='submit' disabled={!renameTitle.trim() || pendingAction === 'rename'}>
                {pendingAction === 'rename' ? t('projectsPage.saving') : t('common.save', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
