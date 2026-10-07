import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useSearchParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStatus } from '../../../../../features/idp/types';
import { DataDestinationType } from '../../../shared';
import { dataDestinationService, useDataDestination } from '../../../shared';
import { DataDestinationList } from './DataDestinationList';

const tableMocks = vi.hoisted(() => ({
  onDelete: undefined as ((id: string) => void) | undefined,
}));

const detailMocks = vi.hoisted(() => ({
  getDataDestinationById: vi.fn(),
}));

vi.mock('../../../shared', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../shared')>();
  return {
    ...actual,
    dataDestinationService: {
      getDataDestinationImpact: vi.fn(),
    },
    useDataDestination: vi.fn(),
  };
});

vi.mock('../../../../../features/idp', () => ({
  useAuth: () => ({
    status: AuthStatus.AUTHENTICATED,
    user: {
      id: 'user-1',
      projectId: 'project-1',
      roles: ['admin'],
    },
  }),
}));

vi.mock('../DataDestinationTable', () => ({
  DataDestinationTable: ({
    data,
    onEdit,
  }: {
    data: { id: string; title: string }[];
    onEdit?: (id: string) => Promise<void>;
  }) => (
    <div>
      {data.map(destination => (
        <div key={destination.id}>
          <button
            type='button'
            onClick={() => {
              tableMocks.onDelete?.(destination.id);
            }}
          >
            Delete {destination.title}
          </button>
          <button
            type='button'
            onClick={() => {
              void onEdit?.(destination.id);
            }}
          >
            Edit {destination.title}
          </button>
        </div>
      ))}
    </div>
  ),
  getDataDestinationColumns: vi.fn(({ onDelete }: { onDelete?: (id: string) => void }) => {
    tableMocks.onDelete = onDelete;
    return [];
  }),
}));

vi.mock('../../../edit', () => ({
  DataDestinationConfigSheet: ({ isOpen, onClose }: { isOpen: boolean; onClose?: () => void }) =>
    isOpen ? (
      <div data-testid='destinationEditSheet'>
        <button type='button' onClick={onClose}>
          Close destination
        </button>
      </div>
    ) : null,
}));

function LocationSearch() {
  const { search } = useLocation();
  return <output data-testid='locationSearch'>{search}</output>;
}

function DeepLinkControls() {
  const [, setSearchParams] = useSearchParams();
  return (
    <>
      <button
        type='button'
        onClick={() => {
          setSearchParams({ id: 'destination-1' });
        }}
      >
        Open destination 1
      </button>
      <button
        type='button'
        onClick={() => {
          setSearchParams({ id: 'destination-2' });
        }}
      >
        Open destination 2
      </button>
      <button
        type='button'
        onClick={() => {
          setSearchParams({ id: 'destination-1' });
        }}
      >
        Return to destination 1
      </button>
    </>
  );
}

describe('DataDestinationList', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useDataDestination).mockReturnValue({
      dataDestinations: [
        {
          id: 'destination-1',
          title: '[Ok OAuth] Sheets',
          type: DataDestinationType.GOOGLE_SHEETS,
          projectId: 'project-1',
          credentials: {},
          createdAt: new Date('2026-06-09T10:00:00.000Z'),
          modifiedAt: new Date('2026-06-09T10:00:00.000Z'),
          contexts: [],
        },
        {
          id: 'destination-2',
          title: 'Destination 2',
          type: DataDestinationType.GOOGLE_SHEETS,
          projectId: 'project-1',
          credentials: {},
          createdAt: new Date('2026-06-09T10:00:00.000Z'),
          modifiedAt: new Date('2026-06-09T10:00:00.000Z'),
          contexts: [],
        },
      ],
      currentDataDestination: null,
      loading: false,
      error: null,
      fetchDataDestinations: vi.fn(),
      getDataDestinationById: detailMocks.getDataDestinationById,
      createDataDestination: vi.fn(),
      updateDataDestination: vi.fn(),
      deleteDataDestination: vi.fn(),
      clearCurrentDataDestination: vi.fn(),
      rotateSecretKey: vi.fn(),
    });
  });

  function renderList() {
    return render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/ui/project-1/data-destinations']}>
          <LocationSearch />
          <DeepLinkControls />
          <DataDestinationList />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it('loads destination details once when opening edit updates the deep link', async () => {
    detailMocks.getDataDestinationById.mockResolvedValue({ id: 'destination-1' });

    renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Edit [Ok OAuth] Sheets' }));

    await screen.findByTestId('destinationEditSheet');
    await waitFor(() => {
      expect(screen.getByTestId('locationSearch')).toHaveTextContent('id=destination-1');
    });
    expect(detailMocks.getDataDestinationById).toHaveBeenCalledWith('destination-1');
    expect(detailMocks.getDataDestinationById).toHaveBeenCalledTimes(1);
  });

  it('links blocked destination reports to the project reports page filtered by destination', async () => {
    vi.mocked(dataDestinationService.getDataDestinationImpact).mockResolvedValueOnce({
      destinationId: 'destination-1',
      destinationTitle: '[Ok OAuth] Sheets',
      reportsCount: 17,
      dataMartCount: 2,
    });

    renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Delete [Ok OAuth] Sheets' }));

    const reportsLink = await screen.findByRole('link', { name: '17 Reports' });
    const url = new URL(reportsLink.getAttribute('href') ?? '', 'http://localhost');

    expect(url.pathname).toBe('/ui/project-1/data-marts/reports');
    expect(JSON.parse(url.searchParams.get('filters') ?? '[]')).toEqual([
      { f: 'destination', o: 'eq', v: ['[Ok OAuth] Sheets'] },
    ]);
    await waitFor(() => {
      expect(dataDestinationService.getDataDestinationImpact).toHaveBeenCalledWith('destination-1');
    });
  });

  it('does not open the edit sheet when loading destination details fails', async () => {
    const getDataDestinationById = vi.fn().mockRejectedValue(new Error('not found'));
    vi.mocked(useDataDestination).mockReturnValue({
      dataDestinations: [
        {
          id: 'destination-1',
          title: '[Ok OAuth] Sheets',
          type: DataDestinationType.GOOGLE_SHEETS,
          projectId: 'project-1',
          credentials: {},
          createdAt: new Date('2026-06-09T10:00:00.000Z'),
          modifiedAt: new Date('2026-06-09T10:00:00.000Z'),
          contexts: [],
        },
      ],
      currentDataDestination: null,
      loading: false,
      error: null,
      fetchDataDestinations: vi.fn(),
      getDataDestinationById,
      createDataDestination: vi.fn(),
      updateDataDestination: vi.fn(),
      deleteDataDestination: vi.fn(),
      clearCurrentDataDestination: vi.fn(),
      rotateSecretKey: vi.fn(),
    });

    renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Edit [Ok OAuth] Sheets' }));

    await waitFor(() => {
      expect(getDataDestinationById).toHaveBeenCalledWith('destination-1');
    });
    expect(screen.queryByTestId('destinationEditSheet')).not.toBeInTheDocument();
  });

  it('handles A/B/A deep-link transitions while keeping a manually closed id closed', async () => {
    detailMocks.getDataDestinationById.mockImplementation(async (id: string) => ({ id }));

    renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Open destination 1' }));
    await screen.findByTestId('destinationEditSheet');
    await waitFor(() => {
      expect(detailMocks.getDataDestinationById).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open destination 2' }));
    await waitFor(() => {
      expect(detailMocks.getDataDestinationById).toHaveBeenCalledWith('destination-2');
    });
    expect(detailMocks.getDataDestinationById).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Return to destination 1' }));
    await waitFor(() => {
      expect(detailMocks.getDataDestinationById).toHaveBeenCalledTimes(3);
    });
    expect(detailMocks.getDataDestinationById).toHaveBeenLastCalledWith('destination-1');

    fireEvent.click(screen.getByRole('button', { name: 'Close destination' }));
    await waitFor(() => {
      expect(screen.queryByTestId('destinationEditSheet')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('locationSearch')).not.toHaveTextContent('id=');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Return to destination 1' }));
    await screen.findByTestId('destinationEditSheet');
    await waitFor(() => {
      expect(detailMocks.getDataDestinationById).toHaveBeenCalledTimes(4);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close destination' }));
    await waitFor(() => {
      expect(screen.queryByTestId('destinationEditSheet')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit [Ok OAuth] Sheets' }));
    await screen.findByTestId('destinationEditSheet');
    expect(detailMocks.getDataDestinationById).toHaveBeenCalledTimes(5);
  });
});
