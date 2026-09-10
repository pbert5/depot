import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TestWrapper } from '@/test/test-utils';
import { mockRosterUnit } from '@/test/mock-data';
import CollectionSelectionCard from './collection-selection-card';

const collectionUnit = {
  ...mockRosterUnit,
  id: 'collection-unit-1',
  state: 'built' as const
};

describe('CollectionSelectionCard', () => {
  it('exposes selection as a pressed, labeled control', () => {
    const onToggle = vi.fn();

    render(
      <TestWrapper>
        <CollectionSelectionCard unit={collectionUnit} selected={false} onToggle={onToggle} />
      </TestWrapper>
    );

    const toggle = screen.getByRole('button', { name: 'Select Captain for roster' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);

    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith(collectionUnit.id);
  });

  it('keeps the selected state and removal action discoverable', () => {
    const onToggle = vi.fn();

    render(
      <TestWrapper>
        <CollectionSelectionCard unit={collectionUnit} selected onToggle={onToggle} />
      </TestWrapper>
    );

    const toggle = screen.getByRole('button', { name: 'Remove Captain from roster' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveTextContent('Selected');
  });
});
