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

  it('lists compatible attachment targets with duplicate names disambiguated and saves the selection', () => {
    const leader = createMockRosterUnit({
      datasheet: createMockDatasheet({ leaders: [{ id: 'bodyguard', slug: 'bodyguard' }] })
    });
    const targetOne = createMockRosterUnit({
      id: 'bodyguard-1',
      datasheet: createMockDatasheet({ id: 'bodyguard', slug: 'bodyguard', name: 'Bodyguard' })
    });
    const targetTwo = createMockRosterUnit({
      id: 'bodyguard-2',
      datasheet: createMockDatasheet({ id: 'bodyguard', slug: 'bodyguard', name: 'Bodyguard' })
    });
    const onSave = vi.fn();

    render(
      <UnitEditShell
        unit={leader}
        testId="edit-unit-form"
        backTo="/rosters/roster-1/edit#unit-unit-1"
        backLabel="Roster"
        documentTitle="Edit unit"
        title={leader.datasheet.name}
        onSave={onSave}
        {...{
          attachmentTargets: [
            { unit: targetOne, label: 'Bodyguard · Unit 1' },
            { unit: targetTwo, label: 'Bodyguard · Unit 2' }
          ]
        }}
      />,
      { wrapper: TestWrapper }
    );

    const attachment = screen.getByTestId('unit-attachment-select') as HTMLSelectElement;
    expect(Array.from(attachment.options).map((option) => option.text)).toEqual([
      'Not attached',
      'Bodyguard · Unit 1',
      'Bodyguard · Unit 2'
    ]);

    fireEvent.change(attachment, { target: { value: targetTwo.id } });
    fireEvent.click(screen.getByTestId('save-button'));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ attachedToUnitId: targetTwo.id }));
  });

  it('does not render an attachment control when no targets are provided', () => {
    render(
      <UnitEditShell
        unit={createMockRosterUnit()}
        testId="edit-unit-form"
        backTo="/rosters/roster-1/edit"
        backLabel="Roster"
        documentTitle="Edit unit"
        title="Captain"
        onSave={vi.fn()}
      />,
      { wrapper: TestWrapper }
    );

    expect(screen.queryByTestId('unit-attachment-select')).not.toBeInTheDocument();
  });
});
