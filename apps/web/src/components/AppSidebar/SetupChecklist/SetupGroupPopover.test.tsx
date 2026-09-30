import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SetupGroupPopover } from './SetupGroupPopover';
import {
  GroupId,
  GroupStatusType,
  ProgressKey,
  SetupStepId,
  type ProjectSetupProgress,
} from './types';

vi.mock('../../../shared/hooks', () => ({
  useProjectRoute: () => ({ scope: (path: string) => path }),
}));

const progress = Object.fromEntries(
  Object.values(ProgressKey).map(key => [key, { done: false, completedAt: null }])
) as ProjectSetupProgress;

const groupProgress = {
  group: {
    id: GroupId.STORAGE,
    title: 'Create first storage',
    description: 'Connect a warehouse',
    stepIds: [SetupStepId.CREATE_STORAGE],
  },
  status: GroupStatusType.NOT_STARTED,
  completedCount: 0,
  totalCount: 1,
  completedAt: null,
};

describe('SetupGroupPopover', () => {
  it('stays closed until the user opens the group and fits the viewport', () => {
    render(
      <MemoryRouter>
        <SetupGroupPopover groupProgress={groupProgress} progress={progress} />
      </MemoryRouter>
    );

    expect(screen.queryByText('Create storage')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create first storage' }));

    expect(screen.getByText('Create storage')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="popover-content"]')).toHaveClass(
      'max-h-[min(80vh,42rem)]',
      'w-[min(24rem,calc(100vw-2rem))]'
    );
  });
});
