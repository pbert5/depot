import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RosterProvider, useRoster } from './context';
import { createMockRoster } from '@/test/mock-data';

// Mock offline storage using vi.hoisted for proper scoping
const mockOfflineStorage = vi.hoisted(() => ({
  getRoster: vi.fn(),
  saveRoster: vi.fn(),
  saveRosterToServer: vi.fn(),
  saveRosterLocally: vi.fn()
}));

const mockToastContext = vi.hoisted(() => ({
  showToast: vi.fn(),
  removeToast: vi.fn()
}));

vi.mock('../../data/offline-storage', () => ({
  offlineStorage: mockOfflineStorage
}));

// The roster load path rehydrates units from the catalog.
const mockCatalog = vi.hoisted(() => ({
  getDatasheet: vi.fn().mockResolvedValue(null),
  getFactionManifest: vi.fn().mockResolvedValue(null)
}));

vi.mock('@/contexts/factions/context', () => ({
  useFactionsContext: () => mockCatalog
}));

vi.mock('@/contexts/toast/context', () => ({
  useToast: () => ({
    state: { toasts: [] },
    showToast: mockToastContext.showToast,
    removeToast: mockToastContext.removeToast
  })
}));

// Test component to consume the context
const TestComponent = ({ rosterId: _rosterId }: { rosterId?: string }) => {
  const { state, createRoster, updateRosterDetails } = useRoster();

  const handleCreateRoster = () => {
    const newId = createRoster({
      name: 'Test Roster',
      factionId: 'SM',
      factionSlug: 'space-marines',
      faction: {
        id: 'SM',
        slug: 'space-marines',
        name: 'Space Marines',
        path: '/data/space-marines.json',
        datasheetCount: 50,
        detachmentCount: 4
      },
      maxPoints: 2000,
      detachments: [
        {
          id: 'test-detachment',
          slug: 'test-detachment',
          name: 'Test Detachment',
          legend: '',
          type: '',
          dp: '',
          forceDisposition: '',
          chapterDp: [],
          abilities: [],
          enhancements: [],
          stratagems: []
        }
      ]
    });
    return newId;
  };

  return (
    <div>
      <div data-testid="roster-id">{state.id}</div>
      <div data-testid="roster-name">{state.name}</div>
      <div data-testid="roster-faction">{state.faction?.name}</div>
      <div data-testid="roster-points">
        {state.points.current}/{state.points.max}
      </div>
      <button data-testid="create-roster" onClick={handleCreateRoster}>
        Create Roster
      </button>
      <button
        data-testid="rename-roster"
        onClick={() => updateRosterDetails({ name: 'Updated Roster', detachments: state.detachments, maxPoints: state.points.max })}
      >
        Rename Roster
      </button>
    </div>
  );
};

// Test wrapper with RosterProvider
const TestWrapper = ({ rosterId, children }: { rosterId?: string; children: ReactNode }) => (
  <RosterProvider rosterId={rosterId}>{children}</RosterProvider>
);

describe('RosterProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOfflineStorage.saveRosterToServer.mockResolvedValue(undefined);
    mockOfflineStorage.saveRosterLocally.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should initialize with empty roster state', () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(screen.getByTestId('roster-id')).toHaveTextContent('');
    expect(screen.getByTestId('roster-name')).toHaveTextContent('');
    expect(screen.getByTestId('roster-faction')).toBeEmptyDOMElement();
    expect(screen.getByTestId('roster-points')).toHaveTextContent('0/2000');
  });

  it('should load roster from storage when rosterId is provided', async () => {
    const testRoster = createMockRoster({
      id: 'test-roster-id',
      name: 'Test Roster',
      points: { current: 500, max: 2000 }
    });

    mockOfflineStorage.getRoster.mockResolvedValue(testRoster);

    render(
      <TestWrapper rosterId="test-roster-id">
        <TestComponent rosterId="test-roster-id" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('roster-id')).toHaveTextContent('test-roster-id');
      expect(screen.getByTestId('roster-name')).toHaveTextContent('Test Roster');
      expect(screen.getByTestId('roster-faction')).toHaveTextContent('Space Marines');
      // persisted total should be normalised via calculateTotalPoints
      expect(screen.getByTestId('roster-points')).toHaveTextContent('80/2000');
    });

    expect(mockOfflineStorage.getRoster).toHaveBeenCalledWith('test-roster-id');
  });

  it('should handle storage errors gracefully when loading roster', async () => {
    const error = new Error('Storage error');
    mockOfflineStorage.getRoster.mockRejectedValue(error);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <TestWrapper rosterId="test-roster-id">
        <TestComponent rosterId="test-roster-id" />
      </TestWrapper>
    );

    // Should remain in initial state on error
    await waitFor(() => {
      expect(screen.getByTestId('roster-id')).toHaveTextContent('');
    });

    expect(mockOfflineStorage.getRoster).toHaveBeenCalledWith('test-roster-id');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to load roster:', error);

    consoleSpy.mockRestore();
  });

  it('should create new roster with generated ID', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    act(() => {
      screen.getByTestId('create-roster').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('roster-name')).toHaveTextContent('Test Roster');
      expect(screen.getByTestId('roster-faction')).toHaveTextContent('Space Marines');
      expect(screen.getByTestId('roster-points')).toHaveTextContent('0/2000');
    });

    // Should have generated a UUID
    const rosterId = screen.getByTestId('roster-id').textContent;
    expect(rosterId).toBeTruthy();
    expect(rosterId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('debounces and coalesces roster changes, then reports Saved', async () => {
    vi.useFakeTimers();
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    act(() => {
      screen.getByTestId('create-roster').click();
    });

    expect(screen.getByTestId('roster-save-status')).toHaveTextContent('Unsaved changes');
    act(() => vi.advanceTimersByTime(749));
    expect(mockOfflineStorage.saveRosterToServer).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(mockOfflineStorage.saveRosterToServer).toHaveBeenCalledTimes(1);

    const savedRoster = mockOfflineStorage.saveRosterToServer.mock.calls[0][0];
    expect(savedRoster).toMatchObject({
      name: 'Test Roster',
      factionId: 'SM',
      factionSlug: 'space-marines',
      points: { current: 0, max: 2000 }
    });
    expect(screen.getByTestId('roster-save-status')).toHaveTextContent('Saved');
  });

  it('should not save initial empty state', () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Should not save immediately since state.id is empty
    expect(mockOfflineStorage.saveRoster).not.toHaveBeenCalled();
  });

  it('keeps edits and exposes failure with bounded retry and manual retry', async () => {
    vi.useFakeTimers();
    const error = new Error('IndexedDB write failure');
    mockOfflineStorage.saveRosterToServer.mockRejectedValueOnce(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    act(() => {
      screen.getByTestId('create-roster').click();
    });
    act(() => vi.advanceTimersByTime(750));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('roster-save-status')).toHaveTextContent('Save failed');
    expect(screen.getByTestId('roster-name')).toHaveTextContent('Test Roster');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    expect(mockOfflineStorage.saveRosterToServer).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to auto-save roster'), error);

    act(() => {
      screen.getByRole('button', { name: 'Retry' }).click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('roster-save-status')).toHaveTextContent('Saved');
    expect(mockOfflineStorage.saveRosterToServer).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore();
  });

  it('does not let an out-of-order response acknowledge newer edits', async () => {
    vi.useFakeTimers();
    const first = deferred<void>();
    const second = deferred<void>();
    mockOfflineStorage.saveRosterToServer.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );
    act(() => {
      screen.getByTestId('create-roster').click();
    });
    act(() => vi.advanceTimersByTime(750));
    expect(mockOfflineStorage.saveRosterToServer).toHaveBeenCalledTimes(1);

    act(() => {
      screen.getByTestId('rename-roster').click();
    });
    act(() => vi.advanceTimersByTime(750));
    expect(mockOfflineStorage.saveRosterToServer).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('roster-save-status')).toHaveTextContent('Saving…');

    await act(async () => {
      first.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('roster-save-status')).toHaveTextContent('Saving…');
    await act(async () => {
      second.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('roster-save-status')).toHaveTextContent('Saved');
  });
});

function deferred<T>() {
  let resolve!: (value?: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = (value) => res(value as T);
    reject = rej;
  });
  return { promise, resolve, reject };
}
