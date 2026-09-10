import type {
  Collection,
  CollectionUnit,
  CollectionUnitState,
  Datasheet,
  ModelCost
} from '../types/depot.js';
import { getDefaultWargearSelection } from './wargear.js';
import { createId } from './id.js';

export const COLLECTION_UNIT_STATES: CollectionUnitState[] = [
  'sprue',
  'built',
  'battle-ready',
  'parade-ready'
];

export const getCollectionUnitState = (value?: string | null): CollectionUnitState =>
  COLLECTION_UNIT_STATES.includes(value as CollectionUnitState)
    ? (value as CollectionUnitState)
    : 'sprue';

export type CollectionStateCounts = Record<CollectionUnitState, number>;

export const getCollectionStateCounts = (items: CollectionUnit[]): CollectionStateCounts => {
  return items.reduce<CollectionStateCounts>(
    (acc, item) => {
      acc[item.state] = (acc[item.state] ?? 0) + 1;
      return acc;
    },
    Object.fromEntries(COLLECTION_UNIT_STATES.map((state) => [state, 0])) as CollectionStateCounts
  );
};

export const calculateCollectionPoints = (collection: Collection): number => {
  return collection.items.reduce(
    (total, item) => total + (parseInt(item.modelCost.cost, 10) || 0),
    0
  );
};

export const createCollectionUnitFromDatasheet = (
  datasheet: Datasheet,
  modelCost: ModelCost,
  initialState?: string | null
): CollectionUnit => ({
  id: createId(),
  datasheet,
  modelCost,
  selectedWargear: getDefaultWargearSelection(datasheet),
  selectedWargearAbilities: [],
  state: getCollectionUnitState(initialState),
  datasheetSlug: datasheet.slug
});
