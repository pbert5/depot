import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BulkActionBar from './bulk-action-bar';

const makeSelection = (ids: string[]) => ({
  selectedIds: new Set(ids),
  clearSelection: vi.fn()
});

describe('BulkActionBar', () => {
  it('does not render when the selection is empty', () => {
    render(
      <BulkActionBar selection={makeSelection([])} onChangeState={vi.fn()} onRemove={vi.fn()} />
    );

    expect(screen.queryByTestId('bulk-action-bar')).not.toBeInTheDocument();
  });

  it('renders the count and forwards an immutable selection snapshot', () => {
    const selection = makeSelection(['unit-2', 'unit-1']);
    const onChangeState = vi.fn();
    const onRemove = vi.fn();

    render(
      <BulkActionBar selection={selection} onChangeState={onChangeState} onRemove={onRemove} />
    );

    expect(screen.getByText('2 units selected')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('bulk-change-state'));
    fireEvent.click(screen.getByTestId('bulk-remove'));

    expect(onChangeState).toHaveBeenCalledWith(['unit-2', 'unit-1']);
    expect(onRemove).toHaveBeenCalledWith(['unit-2', 'unit-1']);
    expect(onChangeState.mock.calls[0][0]).not.toBe(selection.selectedIds);
  });

  it('supports keyboard-accessible clear and disables actions while busy', () => {
    const selection = makeSelection(['unit-1']);
    const onChangeState = vi.fn();
    const onRemove = vi.fn();

    render(
      <BulkActionBar selection={selection} onChangeState={onChangeState} onRemove={onRemove} busy />
    );

    expect(screen.getByRole('region', { name: 'Bulk actions' })).toBeInTheDocument();
    expect(screen.getByTestId('bulk-change-state')).toBeDisabled();
    expect(screen.getByTestId('bulk-remove')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selected units' }));
    expect(selection.clearSelection).not.toHaveBeenCalled();
  });
});
