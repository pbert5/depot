import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { depot } from '@depot/core';

import UnitEditShell from './unit-edit-shell';
import { TestWrapper } from '@/test/test-utils';
import { createMockDatasheet, createMockRosterUnit } from '@/test/mock-data';

const mockNavigate = vi.fn();

vi.mock('@/lib/navigation', () => ({
  useNavigate: () => mockNavigate
}));

vi.mock('@/components/layout', () => ({
  default: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => (
    <div data-testid="app-layout">
      {children}
      <footer>{footer}</footer>
    </div>
  )
}));

describe('UnitEditShell', () => {
  it('applies the current unit configuration', () => {
    const datasheet = createMockDatasheet({
      abilities: [
        {
          id: 'wargear-ability',
          name: 'Blade Storm',
          legend: '',
          factionId: 'SM',
          description: 'Improves this weapon.',
          type: 'Wargear'
        }
      ]
    });
    const unit = createMockRosterUnit({ datasheet });
    const onSave = vi.fn<(selection: {
      selectedWargear: depot.Wargear[];
      selectedWargearAbilities: depot.Ability[];
      selectedModelCost?: depot.ModelCost;
    }) => void>();

    render(
      <UnitEditShell
        unit={unit}
        testId="edit-unit-form"
        backTo="/rosters/roster-1/edit#unit-unit-1"
        backLabel="Roster"
        documentTitle="Edit unit"
        title={unit.datasheet.name}
        onSave={onSave}
      />,
      { wrapper: TestWrapper }
    );

    fireEvent.click(screen.getByTestId(`wargear-pill-${datasheet.wargear[1].id}`));
    fireEvent.click(screen.getByTestId('wargear-ability-pill-blade-storm'));
    fireEvent.click(screen.getByTestId('save-button'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedWargear: expect.arrayContaining([
          expect.objectContaining({ id: datasheet.wargear[0].id }),
          expect.objectContaining({ id: datasheet.wargear[1].id })
        ]),
        selectedWargearAbilities: [expect.objectContaining({ id: 'wargear-ability' })],
        selectedModelCost: unit.modelCost
      })
    );
  });

  it('cancels without submitting and navigates back to the roster edit anchor', () => {
    const unit = createMockRosterUnit();
    const onSave = vi.fn();

    render(
      <UnitEditShell
        unit={unit}
        testId="edit-unit-form"
        backTo="/rosters/roster-1/edit#unit-unit-1"
        backLabel="Roster"
        documentTitle="Edit unit"
        title={unit.datasheet.name}
        onSave={onSave}
      />,
      { wrapper: TestWrapper }
    );

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onSave).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/rosters/roster-1/edit#unit-unit-1');
  });
});
