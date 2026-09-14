import type { FC } from 'react';
import type { RosterSaveState } from '@/contexts/roster/types';
import { useRosterSaveStatusVisibility } from './use-roster-save-status-visibility';

interface RosterSaveStatusProps {
  saveState: RosterSaveState;
  onRetry: () => void;
}

const labels: Record<RosterSaveState, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Unsaved changes',
  failed: 'Save failed'
};

const RosterSaveStatus: FC<RosterSaveStatusProps> = ({ saveState, onRetry }) => {
  const isVisible = useRosterSaveStatusVisibility(saveState);

  if (!isVisible) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-20 flex min-w-0 items-center justify-between gap-2 rounded-sm border border-border-strong bg-surface-card px-3 py-2 text-xs text-subtle shadow-lg sm:left-auto sm:right-3 sm:max-w-[18rem]"
      data-testid="roster-save-status"
      aria-live="polite"
    >
      <span className="min-w-0 truncate">{labels[saveState]}</span>
      {saveState === 'failed' ? (
        <button
          type="button"
          className="pointer-events-auto shrink-0 font-bold text-accent-600 underline"
          onClick={onRetry}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
};

export default RosterSaveStatus;
