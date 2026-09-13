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
});
