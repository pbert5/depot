import React, { useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from '@/lib/navigation';
import { Copy, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import type { depot } from '@depot/core';

import { IconButton } from '@/components/ui';
import { RosterUnitCardCompact, RosterUnitProfilePanel } from '@/components/shared/roster';

interface CollectionUnitCardProps {
  unit: depot.RosterUnit;
  collectionId: string;
  onRemove: (unitId: string) => void;
  onDuplicate: (unit: depot.RosterUnit) => void;
  state?: depot.CollectionUnitState;
  dataTestId?: string;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelection?: (unitId: string) => void;
}

const CollectionUnitCard: React.FC<CollectionUnitCardProps> = ({
  unit,
  collectionId,
  onRemove,
  onDuplicate,
  state,
  dataTestId,
  selectionMode = false,
  selected = false,
  onToggleSelection
}) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCardClick = () => {
    if (selectionMode) {
      onToggleSelection?.(unit.id);
      return;
    }
    navigate(`/collections/${collectionId}/units/${unit.id}/edit`);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent) => {
    if (!selectionMode || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onToggleSelection?.(unit.id);
  };

  const handleToggleExpand = (event: MouseEvent) => {
    event.stopPropagation();
    setIsExpanded((previous) => !previous);
  };

  const actions = (
    <div className="flex items-center gap-2">
      <IconButton
        onClick={(event) => {
          event.stopPropagation();
          onDuplicate(unit);
        }}
        aria-label="Duplicate unit"
        variant="ghost"
        size="sm"
        className="text-info-fg hover:bg-info-surface"
      >
        <Copy size={16} />
      </IconButton>
      <IconButton
        onClick={(event) => {
          event.stopPropagation();
          onRemove(unit.id);
        }}
        aria-label="Remove unit from collection"
        variant="ghost"
        size="sm"
        className="text-danger-fg hover:bg-danger-surface"
      >
        <Trash2 size={16} />
      </IconButton>
      <IconButton
        onClick={handleToggleExpand}
        aria-label={isExpanded ? 'Collapse unit details' : 'Expand unit details'}
        variant="ghost"
        size="sm"
        className="text-subtle hover:text-foreground"
        data-testid="collection-unit-toggle-details"
      >
        {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </IconButton>
    </div>
  );

  return (
    <RosterUnitCardCompact
      id={`collection-unit-${unit.id}`}
      unit={unit}
      actions={selectionMode ? undefined : actions}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role={selectionMode ? 'checkbox' : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      aria-checked={selectionMode ? selected : undefined}
      aria-label={selectionMode ? `Select ${unit.datasheet.name}` : undefined}
      state={state}
      dataTestId={dataTestId}
      showWargearSummary={!isExpanded}
      className={selected ? 'border-border-accent bg-surface-accent' : undefined}
    >
      {isExpanded ? (
        <div
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <RosterUnitProfilePanel unit={unit} abilitiesTestId="collection-unit-abilities" />
        </div>
      ) : null}
    </RosterUnitCardCompact>
  );
};

export default CollectionUnitCard;
