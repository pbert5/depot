import React from 'react';
import type { depot } from '@depot/core';
import WargearRow from './wargear-row';
import type { WargearQuantityAdapter } from '../unit-edit/wargear-quantity-adapter';

interface WargearSectionProps {
  wargear: depot.Wargear[];
  title: string;
  selectedWargear: depot.Wargear[];
  onSelectionChange: (wargear: depot.Wargear, selected: boolean) => void;
  quantityAdapter?: WargearQuantityAdapter;
}

const WargearSection: React.FC<WargearSectionProps> = ({
  wargear,
  title,
  selectedWargear,
  onSelectionChange,
  quantityAdapter
}) => {
  if (wargear.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-1.5"
      data-testid={`${title.toLowerCase().replace(/\s+/g, '-')}-wargear-section`}
    >
      {/* Subordinate to the `// WARGEAR` rule above it, so it stays a quiet label. */}
      <h4 className="font-mono text-[9.5px] font-medium uppercase tracking-wide text-subtle">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {wargear.map((weapon) => (
          <WargearRow
            key={weapon.id}
            weapon={weapon}
            selected={selectedWargear.some((selected) => selected.id === weapon.id)}
            onToggle={onSelectionChange}
            quantityAdapter={quantityAdapter}
          />
        ))}
      </div>
    </div>
  );
};

export default WargearSection;
