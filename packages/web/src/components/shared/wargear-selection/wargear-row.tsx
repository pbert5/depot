import { cx } from '@/utils/cx';
import type { depot } from '@depot/core';
import QuantityStepper from '@/components/ui/quantity-stepper';
import type { WargearQuantityAdapter } from '../unit-edit/wargear-quantity-adapter';

interface WargearRowProps {
  weapon: depot.Wargear;
  selected: boolean;
  onToggle: (wargear: depot.Wargear, selected: boolean) => void;
  quantityAdapter?: WargearQuantityAdapter;
}

const WargearRow = ({ weapon, selected, onToggle, quantityAdapter }: WargearRowProps) => {
  const control = quantityAdapter?.controls.get(weapon.id);
  if (control?.counted) {
    const decreaseLabel = `Decrease ${weapon.name}`;
    const increaseLabel = `Increase ${weapon.name}`;
    return (
      <div
        className="flex min-h-11 flex-1 items-center justify-between gap-2 rounded-sm border border-border-subtle bg-surface-card px-3 py-1.5 text-sm sm:flex-none sm:min-w-64"
        data-testid={`wargear-counted-${weapon.id}`}
      >
        <span className="min-w-0 truncate font-bold text-foreground">{weapon.name}</span>
        <QuantityStepper
          value={control.quantity}
          min={control.min}
          max={control.max}
          onDecrease={() => onToggle(weapon, false)}
          onIncrease={() => onToggle(weapon, true)}
          decreaseLabel={decreaseLabel}
          increaseLabel={increaseLabel}
          decreaseDisabledReason={control.decreaseReason}
          increaseDisabledReason={control.increaseReason}
          disabledReasonId={`wargear-reason-${weapon.id}`}
        />
        <span className="font-mono text-xs text-subtle" data-testid={`wargear-count-${weapon.id}`}>
          {control.max === undefined ? control.quantity : `${control.quantity} / ${control.max}`}
        </span>
        <span id={`wargear-reason-${weapon.id}`} className="sr-only">
          {control.increaseReason ?? control.decreaseReason ?? 'No additional restriction.'}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(weapon, !selected)}
      className={cx(
        'inline-flex cursor-pointer items-center gap-2 rounded-sm border px-3 min-h-11 text-sm font-bold transition focus-ring-primary',
        selected
          ? 'border-border-accent bg-surface-accent text-accent shadow-e1'
          : 'border-border-subtle bg-surface-card text-foreground hover:border-border-accent hover:bg-surface-accent'
      )}
      aria-pressed={selected}
      data-testid={`wargear-pill-${weapon.id}`}
    >
      {weapon.name}
    </button>
  );
};

export default WargearRow;
