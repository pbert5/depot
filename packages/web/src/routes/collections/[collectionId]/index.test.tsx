import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { depot } from '@depot/core';

import CollectionPage from './index';
import { TestWrapper } from '@/test/test-utils';
import { mockDatasheet, mockFactionIndex } from '@/test/mock-data';
import type { Action } from '@/components/ui/action-group';

vi.mock('@/components/layout', () => ({
  default: ({
    children,
    heading,
    footer,
    actions
  }: {
    children: ReactNode;
    heading?: { title: string; subtitle?: string; meta?: ReactNode };
    footer?: ReactNode;
    actions?: Action[];
  }) => (
    <div data-testid="app-layout">
      {heading?.title ? <h1>{heading.title}</h1> : null}
      {heading?.meta}
      {actions?.map((action) => (
        <button
          key={action.ariaLabel}
          type="button"
          onClick={action.onClick}
          aria-label={action.ariaLabel}
          data-testid={action['data-testid']}
        />
      ))}
      {children}
      {footer}
    </div>
  )
}));

vi.mock('@/routes/collections/_components/collection-unit-card', () => ({
  default: ({
    unit,
    dataTestId,
    selectionMode,
    selected,
    onToggleSelection
  }: {
    unit: { id: string; datasheet: { name: string } };
    dataTestId?: string;
    selectionMode?: boolean;
    selected?: boolean;
    onToggleSelection?: (id: string) => void;
  }) => (
    <div
      data-testid={dataTestId}
      role={selectionMode ? 'checkbox' : undefined}
      aria-checked={selectionMode ? selected : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onClick={() => selectionMode && onToggleSelection?.(unit.id)}
      onKeyDown={(event) => {
        if (selectionMode && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onToggleSelection?.(unit.id);
        }
      }}
    >
      {unit.datasheet.name}
    </div>
  )
}));

vi.mock('@/components/ui/drawer', () => ({
  default: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div data-testid="mock-drawer">{children}</div> : null
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ collectionId: 'collection-1' })
  };
});

vi.mock('@/lib/navigation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/navigation')>('@/lib/navigation');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const mockUseCollection = vi.fn();

vi.mock('@/hooks/use-collection', () => ({
  __esModule: true,
  default: (collectionId?: string) => mockUseCollection(collectionId)
}));

const collectionUnit: depot.CollectionUnit = {
  id: 'unit-1',
  datasheet: mockDatasheet,
  datasheetSlug: mockDatasheet.slug,
  modelCost: mockDatasheet.modelCosts[0],
  selectedWargear: [],
  selectedWargearAbilities: [],
  state: 'battle-ready'
};

const secondCollectionUnit: depot.CollectionUnit = {
  ...collectionUnit,
  id: 'unit-2',
  datasheet: { ...mockDatasheet, name: 'Intercessors' },
  state: 'sprue'
};

const collection: depot.Collection = {
  id: 'collection-1',
  name: 'My Marines',
  factionId: 'SM',
  factionSlug: 'space-marines',
  faction: mockFactionIndex,
  items: [collectionUnit, secondCollectionUnit],
  points: { current: 80 }
};

describe('CollectionPage', () => {
  const save = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    window.localStorage.clear();
    mockNavigate.mockClear();
    mockUseCollection.mockReset();
    mockUseCollection.mockReturnValue({
      collection,
      loading: false,
      error: null,
      save
    });
    save.mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders units, state filters and add-units without a Lists tab', () => {
    render(
      <TestWrapper>
        <CollectionPage />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: 'My Marines' })).toBeInTheDocument();
    expect(screen.getByTestId('collection-units-section')).toBeInTheDocument();
    expect(screen.getByTestId('collection-state-filter-all')).toBeInTheDocument();
    expect(screen.getAllByTestId('collection-unit-card')[0]).toHaveTextContent('Captain');
    expect(screen.getByTestId('add-collection-units-button')).toBeInTheDocument();
    expect(screen.getByTestId('create-roster-from-collection-button')).toBeInTheDocument();
    expect(screen.queryByTestId('collection-section-units')).not.toBeInTheDocument();
    expect(screen.queryByTestId('collection-section-lists')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /lists/i })).not.toBeInTheDocument();
  });

  it('keeps the add-units footer when the collection is empty', () => {
    mockUseCollection.mockReturnValue({
      collection: { ...collection, items: [], points: { current: 0 } },
      loading: false,
      error: null,
      save: vi.fn()
    });

    render(
      <TestWrapper>
        <CollectionPage />
      </TestWrapper>
    );

    expect(screen.getByTestId('empty-collection-state')).toBeInTheDocument();
    expect(screen.getByTestId('add-collection-units-button')).toBeInTheDocument();
    expect(screen.queryByTestId('create-roster-from-collection-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('collection-section-lists')).not.toBeInTheDocument();
  });

  it('passes the active build-state filter to add units', () => {
    render(
      <TestWrapper>
        <CollectionPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('collection-state-filter-built'));
    fireEvent.click(screen.getByTestId('add-collection-units-button'));

    expect(mockNavigate).toHaveBeenCalledWith('/collections/collection-1/add-units?state=built');
  });

  it('selects the visible filtered view and clears selection when the filter changes', () => {
    render(
      <TestWrapper>
        <CollectionPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('toggle-selection-mode'));
    fireEvent.click(screen.getByTestId('select-visible-units'));
    expect(screen.getByText('2 units selected')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);

    fireEvent.click(screen.getByTestId('collection-state-filter-sprue'));
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('uses keyboard-accessible cards without navigating in select mode and supports cancel', () => {
    render(
      <TestWrapper>
        <CollectionPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('toggle-selection-mode'));
    const card = screen.getAllByRole('checkbox')[0];
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(screen.getByText('1 unit selected')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('cancel-selection'));
    expect(screen.queryByTestId('selection-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
  });

  it('persists a bulk removal once and clears selection after success', async () => {
    render(
      <TestWrapper>
        <CollectionPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('toggle-selection-mode'));
    fireEvent.click(screen.getByTestId('select-visible-units'));
    fireEvent.click(screen.getByTestId('bulk-remove'));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].items).toHaveLength(0);
    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
  });
});
