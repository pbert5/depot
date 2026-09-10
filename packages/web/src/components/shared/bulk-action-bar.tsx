import type { FC } from 'react';
import { Settings2, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui';
import { cx } from '@/utils/cx';

/**
 * The smallest contract a selection provider needs to expose to bulk actions.
 * Keeping this contract UI-only lets collection and future B1 selection state
 * evolve independently from the action bar.
 */
export interface BulkSelectionContract {
  selectedIds: ReadonlySet<string>;
  clearSelection: () => void;
}

export interface BulkActionBarProps {
  selection: BulkSelectionContract;
  onChangeState: (selectedIds: string[]) => void | Promise<void>;
  onRemove: (selectedIds: string[]) => void | Promise<void>;
  busy?: boolean;
  className?: string;
}

const BulkActionBar: FC<BulkActionBarProps> = ({
  selection,
  onChangeState,
  onRemove,
  busy = false,
  className
}) => {
  const selectedIds = Array.from(selection.selectedIds);
  const selectedCount = selectedIds.length;

  if (selectedCount === 0) return null;

  const countLabel = `${selectedCount} unit${selectedCount === 1 ? '' : 's'} selected`;

  return (
    <div
      className={cx(
        'flex flex-col gap-3 rounded-sm border border-border-accent bg-surface-accent p-3 shadow-e1 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      role="region"
      aria-label="Bulk actions"
      data-testid="bulk-action-bar"
    >
      <p className="text-sm font-semibold text-foreground" aria-live="polite">
        {countLabel}
      </p>

      <div
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        role="group"
        aria-label="Bulk actions"
      >
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void onChangeState(selectedIds)}
          data-testid="bulk-change-state"
        >
          <Settings2 size={16} aria-hidden="true" />
          Change State
        </Button>
        <Button
          type="button"
          size="sm"
          variant="error"
          disabled={busy}
          onClick={() => void onRemove(selectedIds)}
          data-testid="bulk-remove"
        >
          <Trash2 size={16} aria-hidden="true" />
          Remove
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={selection.clearSelection}
          aria-label="Clear selected units"
          data-testid="bulk-clear-selection"
        >
          <X size={16} aria-hidden="true" />
          Clear
        </Button>
      </div>
    </div>
  );
};

export default BulkActionBar;
