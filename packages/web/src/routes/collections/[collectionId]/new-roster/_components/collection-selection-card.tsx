import type { FC } from 'react';
import type { depot } from '@depot/core';

import { Button } from '@/components/ui';
import { RosterUnitCardCompact } from '@/components/shared/roster';

interface CollectionSelectionCardProps {
  unit: depot.CollectionUnit;
  selected: boolean;
  onToggle: (unitId: string) => void;
}

const CollectionSelectionCard: FC<CollectionSelectionCardProps> = ({
  unit,
  selected,
  onToggle
}) => {
  return (
    <RosterUnitCardCompact
      unit={unit}
      state={unit.state}
      onClick={() => onToggle(unit.id)}
      showWargearSummary
      dataTestId={`collection-selection-${unit.id}`}
      className={selected ? 'border-border-accent bg-surface-accent' : undefined}
      actions={
        <Button
          type="button"
          size="sm"
          variant={selected ? 'secondary' : 'accent'}
          aria-label={`${selected ? 'Remove' : 'Select'} ${unit.datasheet.name} ${selected ? 'from' : 'for'} roster`}
          aria-pressed={selected}
          data-testid={`collection-selection-toggle-${unit.id}`}
          onClick={(event) => {
            // The card remains a generous touch target, while the button gives
            // keyboard and assistive-technology users an explicit toggle.
            event.stopPropagation();
            onToggle(unit.id);
          }}
        >
          {selected ? 'Selected' : 'Add'}
        </Button>
      }
    />
  );
};

export default CollectionSelectionCard;
