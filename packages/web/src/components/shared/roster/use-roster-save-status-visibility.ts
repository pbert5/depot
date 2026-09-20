import { useEffect, useState } from 'react';
import type { RosterSaveState } from '@/contexts/roster/types';

const SAVED_STATUS_DISMISS_DELAY = 1_000;

export const useRosterSaveStatusVisibility = (saveState: RosterSaveState) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (saveState !== 'saved') {
      setIsVisible(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsVisible(false);
    }, SAVED_STATUS_DISMISS_DELAY);

    return () => window.clearTimeout(timeoutId);
  }, [saveState]);

  return isVisible;
};
