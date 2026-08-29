import type { FC, ReactNode } from 'react';
import { createContext, useContext, useReducer, useEffect, useMemo, useRef, useState } from 'react';
import { offlineStorage } from '@/data/offline-storage';
import { useFactionsContext } from '@/contexts/factions/context';
import { hydrateRoster } from '@/utils/refresh-user-data';
import type { RosterContextValue, RosterSaveState } from './types';
import { rosterReducer } from './reducer';
import { initialState } from './constants';

export const RosterContext = createContext<RosterContextValue | undefined>(undefined);

interface RosterProviderProps {
  children: ReactNode;
  rosterId?: string;
}

export const RosterProvider: FC<RosterProviderProps> = ({ children, rosterId }) => {
  const [state, dispatch] = useReducer(rosterReducer, initialState);
  const [saveState, setSaveState] = useState<RosterSaveState>('saved');
  const { getDatasheet, getFactionManifest } = useFactionsContext();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const retryCountRef = useRef(0);
  const latestStateRef = useRef(state);
  const skipNextSaveRef = useRef(Boolean(rosterId));

  latestStateRef.current = state;

  // Load roster on mount if rosterId is provided
  useEffect(() => {
    if (rosterId) {
      const loadRoster = async () => {
        try {
          const stored = await offlineStorage.getRoster(rosterId);
          if (stored) {
            const roster = await hydrateRoster(stored, { getDatasheet, getFactionManifest });
            skipNextSaveRef.current = true;
            dispatch({ type: 'SET_ROSTER', payload: roster });
          }
        } catch (err) {
          console.error('Failed to load roster:', err);
        }
      };
      loadRoster();
    }
  }, [rosterId, getDatasheet, getFactionManifest]);

  // Debounced, coalesced server save. The generation check prevents an older
  // response from acknowledging a newer edit.
  useEffect(() => {
    if (!state.id) return;

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      setSaveState('saved');
      return;
    }

    generationRef.current += 1;
    retryCountRef.current = 0;
    setSaveState('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    const generation = generationRef.current;
    const scheduleSave = (delay: number) => {
      saveTimerRef.current = setTimeout(() => {
        if (generation !== generationRef.current) return;
        setSaveState('saving');
        void offlineStorage.saveRosterToServer(latestStateRef.current).then(
          () => {
            if (generation === generationRef.current) setSaveState('saved');
          },
          (error: unknown) => {
            console.error(`Failed to auto-save roster ${latestStateRef.current.id}:`, error);
            if (generation !== generationRef.current) return;
            void offlineStorage.saveRosterLocally(latestStateRef.current).catch((localError: unknown) => {
              console.error(`Failed to keep local roster draft ${latestStateRef.current.id}:`, localError);
            });
            setSaveState('failed');
            if (retryCountRef.current < 3) {
              retryCountRef.current += 1;
              retryTimerRef.current = setTimeout(
                () => scheduleSave(0),
                Math.min(1000 * 2 ** (retryCountRef.current - 1), 4000)
              );
            }
          }
        );
      }, delay);
    };
    scheduleSave(750);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [state]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    },
    []
  );

  const retrySave = () => {
    if (!state.id) return;
    generationRef.current += 1;
    retryCountRef.current = 0;
    setSaveState('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const generation = generationRef.current;
    setSaveState('saving');
    void offlineStorage.saveRosterToServer(latestStateRef.current).then(
      () => {
        if (generation === generationRef.current) setSaveState('saved');
      },
      (error: unknown) => {
        console.error(`Failed to retry roster save ${latestStateRef.current.id}:`, error);
        if (generation === generationRef.current) setSaveState('failed');
        void offlineStorage.saveRosterLocally(latestStateRef.current).catch((localError: unknown) => {
          console.error(`Failed to keep local roster draft ${latestStateRef.current.id}:`, localError);
        });
      }
    );
  };

  // `dispatch` is stable, so the action set is created once.
  const actions = useMemo<Omit<RosterContextValue, 'state' | 'saveState' | 'retrySave'>>(
    () => ({
      createRoster: (payload) => {
        const id = crypto.randomUUID();
        dispatch({ type: 'CREATE_ROSTER', payload: { ...payload, id } });
        return id;
      },
      updateRosterDetails: (payload) => dispatch({ type: 'UPDATE_DETAILS', payload }),
      setRoster: (payload) => dispatch({ type: 'SET_ROSTER', payload }),
      addUnit: (datasheet, modelCost) =>
        dispatch({ type: 'ADD_UNIT', payload: { datasheet, modelCost } }),
      duplicateUnit: (unit) => dispatch({ type: 'DUPLICATE_UNIT', payload: { unit } }),
      removeUnit: (rosterUnitId) => dispatch({ type: 'REMOVE_UNIT', payload: { rosterUnitId } }),
      updateUnitWargear: (rosterUnitId, wargear) =>
        dispatch({ type: 'UPDATE_UNIT_WARGEAR', payload: { rosterUnitId, wargear } }),
      updateUnitWargearAbilities: (rosterUnitId, abilities) =>
        dispatch({ type: 'UPDATE_UNIT_WARGEAR_ABILITIES', payload: { rosterUnitId, abilities } }),
      updateUnitModelCost: (rosterUnitId, modelCost) =>
        dispatch({ type: 'UPDATE_UNIT_MODEL_COST', payload: { rosterUnitId, modelCost } }),
      applyEnhancement: (enhancement, targetUnitId) =>
        dispatch({ type: 'APPLY_ENHANCEMENT', payload: { enhancement, targetUnitId } }),
      removeEnhancement: (enhancementId) =>
        dispatch({ type: 'REMOVE_ENHANCEMENT', payload: { enhancementId } }),
      setWarlord: (unitId) => dispatch({ type: 'SET_WARLORD', payload: { unitId } })
    }),
    []
  );

  const saveLabel = {
    saved: 'Saved',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    failed: 'Save failed'
  }[saveState];

  return (
    <RosterContext.Provider value={{ state, saveState, retrySave, ...actions }}>
      {children}
      {state.id && (
        <div className="fixed bottom-3 right-3 z-20 flex items-center gap-2 rounded-sm border border-border-strong bg-surface-card px-3 py-2 text-xs text-subtle shadow-lg" data-testid="roster-save-status" aria-live="polite">
          <span>{saveLabel}</span>
          {saveState === 'failed' && (
            <button type="button" className="font-bold text-accent-600 underline" onClick={retrySave}>
              Retry
            </button>
          )}
        </div>
      )}
    </RosterContext.Provider>
  );
};

export const useRoster = (): RosterContextValue => {
  const context = useContext(RosterContext);
  if (!context) {
    throw new Error('useRoster must be used within a RosterProvider');
  }
  return context;
};
