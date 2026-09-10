import type { FC } from 'react';
import { Minus, Plus } from 'lucide-react';
import IconButton from '../icon-button';

interface QuantityStepperProps {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  decreaseLabel?: string;
  increaseLabel?: string;
  decreaseDisabledReason?: string;
  increaseDisabledReason?: string;
  disabledReasonId?: string;
}

const QuantityStepper: FC<QuantityStepperProps> = ({
  value,
  onDecrease,
  onIncrease,
  min = 0,
  size = 'md',
  decreaseLabel = 'Decrease quantity',
  increaseLabel = 'Increase quantity',
  decreaseDisabledReason,
  increaseDisabledReason,
  disabledReasonId,
  max
}) => {
  const disableDecrease = value <= min;
  const disableIncrease = max !== undefined && value >= max;

  const iconSize = size === 'sm' ? 14 : 16;

  return (
    <div className="inline-flex items-center gap-1">
      <IconButton
        size={size}
        variant="ghost"
        aria-label={decreaseLabel}
        title={decreaseDisabledReason ?? decreaseLabel}
        aria-describedby={disabledReasonId}
        onClick={onDecrease}
        disabled={disableDecrease}
        aria-disabled={disableDecrease}
      >
        <Minus size={iconSize} />
      </IconButton>
      <span className="min-w-[2rem] text-center type-stat text-base">{value}</span>
      <IconButton
        size={size}
        variant="ghost"
        aria-label={increaseLabel}
        title={increaseDisabledReason ?? increaseLabel}
        aria-describedby={disabledReasonId}
        onClick={onIncrease}
        disabled={disableIncrease}
        aria-disabled={disableIncrease}
      >
        <Plus size={iconSize} />
      </IconButton>
    </div>
  );
};

export default QuantityStepper;
