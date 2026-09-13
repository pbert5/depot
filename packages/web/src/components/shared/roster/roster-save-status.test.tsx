import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RosterSaveStatus from './roster-save-status';

describe('RosterSaveStatus', () => {
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
