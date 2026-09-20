import type { depot } from '@depot/core';

export type RosterState = depot.Roster;

export type RosterSaveState = 'saved' | 'saving' | 'unsaved' | 'failed';

export type RosterAction =
  | { type: 'SET_ROSTER'; payload: depot.Roster }
  | {
      type: 'CREATE_ROSTER';
      payload: {
        id: string;
        factionId: string;
        factionSlug: string;
        faction: depot.Index;
        dataVersion?: string | null;
        maxPoints: number;
        name: string;
        detachments: depot.Detachment[];
        units?: depot.RosterUnit[];
        collectionId?: string | null;
      };
    }
  | {
      type: 'UPDATE_DETAILS';
      payload: { name: string; detachments: depot.Detachment[]; maxPoints: number };
    }
  | {
      type: 'ADD_UNIT';
      payload: { datasheet: depot.Datasheet; modelCost: depot.ModelCost; id?: string };
    }
  | { type: 'DUPLICATE_UNIT'; payload: { unit: depot.RosterUnit } }
  | { type: 'ATTACH_UNIT'; payload: { leaderUnitId: string; bodyguardUnitId: string } }
  | { type: 'DETACH_UNIT'; payload: { leaderUnitId: string } }
  | { type: 'SET_UNIT_ATTACHMENT'; payload: { leaderUnitId: string; bodyguardUnitId: string | null } }
  | { type: 'REMOVE_UNIT'; payload: { rosterUnitId: string } }
  | { type: 'UPDATE_UNIT_WARGEAR'; payload: { rosterUnitId: string; wargear: depot.Wargear[] } }
  | {
      type: 'UPDATE_UNIT_WARGEAR_ABILITIES';
      payload: { rosterUnitId: string; abilities: depot.Ability[] };
    }
  | {
      type: 'UPDATE_UNIT_MODEL_COST';
      payload: { rosterUnitId: string; modelCost: depot.ModelCost };
    }
  | { type: 'APPLY_ENHANCEMENT'; payload: { enhancement: depot.Enhancement; targetUnitId: string } }
  | { type: 'REMOVE_ENHANCEMENT'; payload: { enhancementId: string } }
  | { type: 'SET_WARLORD'; payload: { unitId: string | null } };

type Payload<T extends RosterAction['type']> = Extract<RosterAction, { type: T }>['payload'];

export interface RosterContextValue {
  state: RosterState;
  saveState: RosterSaveState;
  retrySave: () => void;
  /** Returns the generated roster id. */
  createRoster: (payload: Omit<Payload<'CREATE_ROSTER'>, 'id'>) => string;
  updateRosterDetails: (payload: Payload<'UPDATE_DETAILS'>) => void;
  setRoster: (roster: Payload<'SET_ROSTER'>) => void;
  addUnit: (datasheet: depot.Datasheet, modelCost: depot.ModelCost) => void;
  addUnitsAndPersist: (
    units: Array<{ datasheet: depot.Datasheet; modelCost: depot.ModelCost; id?: string }>
  ) => Promise<void>;
  duplicateUnit: (unit: depot.RosterUnit) => void;
  removeUnit: (rosterUnitId: string) => void;
  updateUnitWargear: (rosterUnitId: string, wargear: depot.Wargear[]) => void;
  updateUnitWargearAbilities: (rosterUnitId: string, abilities: depot.Ability[]) => void;
  updateUnitModelCost: (rosterUnitId: string, modelCost: depot.ModelCost) => void;
  setUnitAttachment: (leaderUnitId: string, bodyguardUnitId: string | null) => void;
  applyEnhancement: (enhancement: depot.Enhancement, targetUnitId: string) => void;
  removeEnhancement: (enhancementId: string) => void;
  setWarlord: (unitId: string | null) => void;
}
