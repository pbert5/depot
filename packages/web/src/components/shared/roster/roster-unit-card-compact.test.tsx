import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { depot } from '@depot/core';
import RosterUnitCardCompact from './roster-unit-card-compact';
import { mockDatasheet } from '@/test/mock-data';

const unit = {
  id: 'runtherd-1',
  datasheet: { ...mockDatasheet, name: 'Runtherd', slug: 'runtherd' },
  modelCost: mockDatasheet.modelCosts[0],
  selectedWargear: [],
  selectedWargearAbilities: []
} as depot.RosterUnit;

describe('RosterUnitCardCompact', () => {
  it('shows a readable Warlord label when the unit is nominated', () => {
    render(<RosterUnitCardCompact unit={unit} isWarlord />);

    expect(screen.getByTestId('unit-warlord-tag')).toHaveTextContent('Warlord');
  });

  it('shows the bodyguard relationship for an attached leader', () => {
    render(
      <RosterUnitCardCompact
        unit={{ ...unit, attachedToUnitId: 'bodyguard-1' }}
        attachedToUnitName="Bodyguard · Unit 1"
      />
    );

    expect(screen.getByTestId('unit-attachment')).toHaveTextContent(
      'Attached to Bodyguard · Unit 1'
    );
  });
});
