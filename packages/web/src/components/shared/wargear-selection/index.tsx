import React, { useMemo } from 'react';
import type { depot } from '@depot/core';
import WargearSection from './wargear-section';
import { separateWargearByType } from '@depot/core/utils/wargear';
import type { WargearQuantityAdapter } from '../unit-edit/wargear-quantity-adapter';

interface WargearSelectionProps {
  wargear: depot.Wargear[];
  selectedWargear: depot.Wargear[];
  onSelectionChange: (wargear: depot.Wargear, selected: boolean) => void;
  quantityAdapter?: WargearQuantityAdapter;
}

const WargearSelection: React.FC<WargearSelectionProps> = ({
  wargear,
  selectedWargear,
  onSelectionChange,
  quantityAdapter
}) => {
  const { rangedWargear, meleeWargear, mixedWargear } = useMemo(() => {
    return separateWargearByType(wargear);
  }, [wargear]);

  if (wargear.length === 0) {
    return (
      <div className="text-center py-8" data-testid="no-wargear-available">
        <p className="text-subtle">No wargear available for this unit.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5" data-testid="wargear-table">
      <WargearSection
        wargear={rangedWargear}
        title="Ranged"
        selectedWargear={selectedWargear}
        onSelectionChange={onSelectionChange}
        quantityAdapter={quantityAdapter}
      />
      <WargearSection
        wargear={mixedWargear}
        title="Mixed"
        selectedWargear={selectedWargear}
        onSelectionChange={onSelectionChange}
        quantityAdapter={quantityAdapter}
      />
      <WargearSection
        wargear={meleeWargear}
        title="Melee"
        selectedWargear={selectedWargear}
        onSelectionChange={onSelectionChange}
        quantityAdapter={quantityAdapter}
      />
    </div>
  );
};

export default WargearSelection;
