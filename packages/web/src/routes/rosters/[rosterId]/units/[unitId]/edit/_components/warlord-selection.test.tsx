import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { depot } from '@depot/core';
import WarlordSelection from './warlord-selection';
import { mockDatasheet } from '@/test/mock-data';

const unit = (id: string, name: string): depot.RosterUnit => ({
  id,
  datasheet: { ...mockDatasheet, id, slug: id, name },
  modelCost: mockDatasheet.modelCosts[0],
  selectedWargear: [],
  selectedWargearAbilities: []
});

describe('WarlordSelection', () => {
  it('makes the character nomination control clickable and explains replacement', () => {
    const current = unit('warboss-1', 'Warboss');
    const runtherd = unit('runtherd-1', 'Runtherd');
    const onChange = vi.fn();
    const roster = { units: [current, runtherd], warlordUnitId: current.id } as depot.Roster;

    render(
      <WarlordSelection
        unit={runtherd}
        roster={roster}
        isWarlord={false}
        onWarlordChange={onChange}
      />
    );

    expect(screen.getByTestId('warlord-selection')).toHaveTextContent(
      'Takes the title from Warboss.'
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Nominate as warlord' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
