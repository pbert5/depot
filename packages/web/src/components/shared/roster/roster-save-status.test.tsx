import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RosterSaveStatus from './roster-save-status';

describe('RosterSaveStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['saving', 'Saving…'],
    ['unsaved', 'Unsaved changes']
  ] as const)('shows %s status without auto-dismissal', (saveState, label) => {
    render(<RosterSaveStatus saveState={saveState} onRetry={vi.fn()} />);

    expect(screen.getByTestId('roster-save-status')).toHaveTextContent(label);
    act(() => {
      vi.advanceTimersByTime(1_001);
    });
    expect(screen.getByTestId('roster-save-status')).toBeInTheDocument();
  });

  it('shows Saved and unmounts the overlay after about one second', () => {
    render(<RosterSaveStatus saveState="saved" onRetry={vi.fn()} />);

    expect(screen.getByTestId('roster-save-status')).toHaveTextContent('Saved');
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByTestId('roster-save-status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('roster-save-status')).not.toBeInTheDocument();
  });

  it('reveals a new save cycle after Saved has dismissed', () => {
    const { rerender } = render(<RosterSaveStatus saveState="saved" onRetry={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByTestId('roster-save-status')).not.toBeInTheDocument();

    rerender(<RosterSaveStatus saveState="unsaved" onRetry={vi.fn()} />);
    expect(screen.getByTestId('roster-save-status')).toHaveTextContent('Unsaved changes');

    rerender(<RosterSaveStatus saveState="saved" onRetry={vi.fn()} />);
    expect(screen.getByTestId('roster-save-status')).toHaveTextContent('Saved');
  });

  it('keeps failed status and Retry available without an overlay box after dismissal', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<RosterSaveStatus saveState="saved" onRetry={onRetry} />);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByTestId('roster-save-status')).not.toBeInTheDocument();

    rerender(<RosterSaveStatus saveState="failed" onRetry={onRetry} />);
    expect(screen.getByTestId('roster-save-status')).toHaveTextContent('Save failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByTestId('roster-save-status')).toBeInTheDocument();
  });

  it('uses one polite live status region', () => {
    render(<RosterSaveStatus saveState="saving" onRetry={vi.fn()} />);

    const status = screen.getByTestId('roster-save-status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(document.querySelectorAll('[aria-live="assertive"]')).toHaveLength(0);
  });

  it('keeps Retry an interactive child of the status presentation', () => {
    const onRetry = vi.fn();
    render(<RosterSaveStatus saveState="failed" onRetry={onRetry} />);

    const status = screen.getByTestId('roster-save-status');
    expect(status).toHaveClass('pointer-events-none');
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveClass('pointer-events-auto');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
