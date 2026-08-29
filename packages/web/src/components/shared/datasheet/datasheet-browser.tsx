import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { sortByName } from '@depot/core/utils/common';
import {
  BATTLEFIELD_ROLES,
  BATTLEFIELD_ROLE_LABELS,
  CODEX_SLUG,
  type BattlefieldRole,
  type DatasheetListItem,
  type DatasheetVisibilityFilters,
  buildSupplementLabel,
  deriveSupplementMetadata,
  filterDatasheetsBySettings,
  filterDatasheetsBySupplement,
  getListItemRole,
  getSupplementKey,
  isSupplementEntry,
  normalizeSupplementValue,
  shouldResetSupplementSelection,
  sortDatasheetsBySupplementPreference
} from '@depot/core/utils/datasheets';
import { getMinimumNumericPoints } from '@depot/core/utils/model-costs';
import { Grid, Search } from '@/components/ui';
import PillTabs from '@/components/shared/pill-tabs';
import Sheet from '@/components/ui/sheet';
import useDebounce from '@/hooks/use-debounce';
import { cx } from '@/utils/cx';
import DatasheetSupplementTabs from './datasheet-supplement-tabs';
import DatasheetListItemCard from './datasheet-list-item-card';

interface DatasheetBrowserProps<T extends DatasheetListItem> {
  datasheets: T[];
  renderDatasheet?: (datasheet: T) => ReactNode;
  searchPlaceholder?: string;
  emptyStateMessage?: string;
  showItemCount?: boolean;
  filters?: DatasheetVisibilityFilters;
  /** Extra classes on the results list (e.g. bottom gap so a floating chip clears the last card). */
  resultsClassName?: string;
  /** Enables the richer, stateful catalogue used by add-units routes. */
  catalogueMode?: boolean;
}

type RoleTab = 'all' | BattlefieldRole;
type CatalogueSort = 'name' | 'relevance' | 'points';

const CATALOGUE_SESSION_KEY = 'depot:datasheet-catalogue-state';
const CATALOGUE_SORTS: { value: CatalogueSort; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'name', label: 'Name' },
  { value: 'points', label: 'Points' }
];

const catalogueValue = (value: string | null | undefined, fallback: string) =>
  value && value.trim() ? value : fallback;

const readCatalogueState = (params: URLSearchParams) => {
  let session: Record<string, string> = {};
  try {
    session = JSON.parse(sessionStorage.getItem(CATALOGUE_SESSION_KEY) ?? '{}') as Record<string, string>;
  } catch {
    // Session storage is optional (private browsing and server rendering can reject it).
  }
  const read = (key: string, fallback: string) => catalogueValue(params.get(key), catalogueValue(session[key], fallback));
  return {
    query: read('q', ''),
    group: read('group', 'all') as RoleTab,
    sort: read('sort', 'relevance') as CatalogueSort,
    filter: read('filter', 'all')
  };
};

const searchRelevance = (name: string, query: string): number => {
  const normalizedName = name.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  const words = normalizedName.split(/\s+/);
  if (words.some((word) => word.startsWith(normalizedQuery))) return 2;
  return normalizedName.includes(normalizedQuery) ? 3 : 4;
};

const numericPoints = <T extends DatasheetListItem>(item: T): number => {
  if ('modelCosts' in item) return getMinimumNumericPoints(item.modelCosts) ?? Number.MAX_SAFE_INTEGER;
  const points = item.points?.replace(/\+$/, '');
  return points && /^\d+$/.test(points) ? Number(points) : Number.MAX_SAFE_INTEGER;
};

const deriveSupplementState = <T extends DatasheetListItem>(
  datasheets: T[],
  filters: DatasheetVisibilityFilters | undefined,
  selectedSupplement: string
) => {
  const metadata = deriveSupplementMetadata(filterDatasheetsBySettings(datasheets, filters));
  const selected = normalizeSupplementValue(selectedSupplement || 'all');
  const isFiltered = metadata.hasSupplements && selected !== 'all';
  const codexDatasheets = metadata.hasSupplements
    ? datasheets.filter((sheet) => !isSupplementEntry(sheet))
    : [];
  const activeDatasheets = !isFiltered
    ? []
    : selected === CODEX_SLUG
      ? codexDatasheets
      : datasheets.filter(
          (sheet) => isSupplementEntry(sheet) && getSupplementKey(sheet) === selected
        );
  const filteredActive = filterDatasheetsBySettings(activeDatasheets, filters);

  const label = !metadata.hasSupplements
    ? null
    : (metadata.options.find((option) => option.value === selectedSupplement)?.label ??
      (selectedSupplement && selected !== 'all' ? buildSupplementLabel(selectedSupplement) : null));

  let summary: string | null = null;
  if (isFiltered && label) {
    if (selected === CODEX_SLUG) {
      summary = `${label} (core datasheets): ${filteredActive.length} datasheets`;
    } else {
      const shared = filterDatasheetsBySettings(codexDatasheets, filters).length;
      summary =
        shared === 0
          ? `${label}: ${filteredActive.length} datasheets`
          : `${label}: ${filteredActive.length} datasheets + ${shared} shared core datasheets`;
    }
  }

  return {
    hasSupplements: metadata.hasSupplements,
    tabs: metadata.hasSupplements ? metadata.options : [],
    selected,
    isFiltered,
    activeDatasheets,
    filteredActive,
    datasheets: metadata.hasSupplements
      ? filterDatasheetsBySupplement(datasheets, selectedSupplement)
      : datasheets,
    summary
  };
};

export const DatasheetBrowser = <T extends DatasheetListItem>({
  datasheets,
  renderDatasheet,
  searchPlaceholder = 'Search datasheets...',
  emptyStateMessage = 'No datasheets found.',
  showItemCount = true,
  filters,
  resultsClassName,
  catalogueMode = false
}: DatasheetBrowserProps<T>) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCatalogueState = useMemo(() => readCatalogueState(searchParams), [searchParams]);
  const [selectedSupplement, setSelectedSupplement] = useState(() =>
    catalogueMode ? initialCatalogueState.filter : 'all'
  );
  const [selectedRole, setSelectedRole] = useState<RoleTab>(() =>
    catalogueMode ? initialCatalogueState.group : 'all'
  );
  const [query, setQuery] = useState(() => (catalogueMode ? initialCatalogueState.query : ''));
  const [catalogueSort, setCatalogueSort] = useState<CatalogueSort>(() =>
    catalogueMode ? initialCatalogueState.sort : 'name'
  );
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!catalogueMode) return;
    const values = { q: query, group: selectedRole, sort: catalogueSort, filter: selectedSupplement };
    try {
      sessionStorage.setItem(CATALOGUE_SESSION_KEY, JSON.stringify(values));
    } catch {
      // URL state remains the durable fallback when session storage is unavailable.
    }
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value && value !== 'all' && !(key === 'sort' && value === 'relevance')) next.set(key, value);
      else next.delete(key);
    }
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [catalogueMode, catalogueSort, query, selectedRole, selectedSupplement, searchParams, setSearchParams]);

  const supplement = useMemo(
    () => deriveSupplementState(datasheets, filters, selectedSupplement),
    [datasheets, filters, selectedSupplement]
  );

  // Drop back to "all" when the selected supplement loses every visible datasheet
  // (e.g. legends/forge world toggled off).
  const prevFiltersRef = useRef(filters);
  const prevActiveRef = useRef(supplement.activeDatasheets);
  useEffect(() => {
    const prevFilters = prevFiltersRef.current;
    const prevActive = prevActiveRef.current;
    prevFiltersRef.current = filters;
    prevActiveRef.current = supplement.activeDatasheets;

    if (!supplement.isFiltered) return;

    if (prevActive.length > 0 && supplement.activeDatasheets.length === 0) {
      setSelectedSupplement('all');
      return;
    }

    const filtersChanged =
      prevFilters !== undefined &&
      (prevFilters.showLegends !== filters?.showLegends ||
        prevFilters.showForgeWorld !== filters?.showForgeWorld);

    if (
      filtersChanged &&
      shouldResetSupplementSelection(supplement.activeDatasheets, supplement.filteredActive)
    ) {
      setSelectedSupplement('all');
    }
  }, [filters, supplement]);

  const filteredBySettings = useMemo(
    () => filterDatasheetsBySettings(supplement.datasheets, filters),
    [filters, supplement.datasheets]
  );

  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const searchedDatasheets = useMemo(() => {
    const matches = normalizedQuery
      ? filteredBySettings.filter((sheet) => sheet.name.toLowerCase().includes(normalizedQuery))
      : filteredBySettings;
    if (!catalogueMode) {
      return sortDatasheetsBySupplementPreference(sortByName(matches), supplement.selected, supplement.hasSupplements);
    }
    return [...matches].sort((a, b) => {
      if (catalogueSort === 'points') return numericPoints(a) - numericPoints(b) || a.name.localeCompare(b.name);
      if (catalogueSort === 'relevance' && normalizedQuery) {
        return searchRelevance(a.name, normalizedQuery) - searchRelevance(b.name, normalizedQuery) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [catalogueMode, catalogueSort, filteredBySettings, normalizedQuery, supplement.selected, supplement.hasSupplements]);

  const renderItem: (datasheet: T) => ReactNode =
    renderDatasheet ??
    ((datasheet) => (
      <DatasheetListItemCard
        datasheet={datasheet}
        supplementMetadataHasSupplements={supplement.hasSupplements}
      />
    ));

  // Role pills only on the default card grid. Custom renderers (the add-units
  // picker) stay a flat list. Manifests generated before `role` existed report
  // everything as "other"; stay unfiltered rather than showing one meaningless pill.
  const roleTabs = useMemo(() => {
    if (renderDatasheet && !catalogueMode) return null;
    if (!searchedDatasheets.some((sheet) => getListItemRole(sheet) !== 'other')) return null;

    const counts = new Map<BattlefieldRole, number>();
    for (const sheet of searchedDatasheets) {
      const role = getListItemRole(sheet);
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }

    return [
      { value: 'all' as const, label: 'All', count: searchedDatasheets.length },
      ...BATTLEFIELD_ROLES.filter((role) => (counts.get(role) ?? 0) > 0).map((role) => ({
        value: role,
        label: BATTLEFIELD_ROLE_LABELS[role],
        count: counts.get(role)!
      }))
    ];
  }, [catalogueMode, renderDatasheet, searchedDatasheets]);

  const visibleDatasheets = useMemo(() => {
    if (!catalogueMode && (!roleTabs || selectedRole === 'all')) return searchedDatasheets;
    if (selectedRole === 'all') return searchedDatasheets;
    return searchedDatasheets.filter((sheet) => getListItemRole(sheet) === selectedRole);
  }, [catalogueMode, roleTabs, selectedRole, searchedDatasheets]);

  const emptyMessage = debouncedQuery
    ? 'No datasheets found matching your filters.'
    : emptyStateMessage;

  const resultItems = visibleDatasheets.map((datasheet) => (
    <div key={datasheet.slug} id={datasheet.id}>
      {renderItem(datasheet)}
    </div>
  ));

  const categoryTabs = roleTabs ?? [];
  const catalogueControls = catalogueMode ? (
    <>
      <div className="hidden md:block">
        <PillTabs tabs={categoryTabs} active={selectedRole} onChange={setSelectedRole} ariaLabel="Datasheet categories" testIdPrefix="datasheet-category" />
      </div>
      <div className="flex items-center gap-2 md:hidden">
        <button
          type="button"
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm border border-border-subtle bg-surface-muted px-3 text-sm font-medium text-foreground focus-ring-primary"
          onClick={() => setMobileControlsOpen(true)}
          aria-haspopup="dialog"
          data-testid="datasheet-catalogue-controls"
        >
          <SlidersHorizontal size={16} /> Filters & sorting
        </button>
        <span className="text-xs text-subtle">{visibleDatasheets.length} shown</span>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        <label className="text-sm text-subtle" htmlFor="datasheet-sort">Sort</label>
        <select id="datasheet-sort" className="input-base w-auto" value={catalogueSort} onChange={(event) => setCatalogueSort(event.target.value as CatalogueSort)} data-testid="datasheet-sort">
          {CATALOGUE_SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <Sheet open={mobileControlsOpen} onClose={() => setMobileControlsOpen(false)} title="Catalogue filters" data-testid="datasheet-catalogue-sheet">
        <div className="flex flex-col gap-4">
          <PillTabs tabs={categoryTabs} active={selectedRole} onChange={setSelectedRole} ariaLabel="Datasheet categories" testIdPrefix="datasheet-mobile-category" />
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground" htmlFor="datasheet-mobile-sort">
            Sort
            <select id="datasheet-mobile-sort" className="input-base" value={catalogueSort} onChange={(event) => setCatalogueSort(event.target.value as CatalogueSort)} data-testid="datasheet-mobile-sort">
              {CATALOGUE_SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" className="min-h-11 rounded-sm bg-accent px-3 font-medium text-white focus-ring-primary" onClick={() => setMobileControlsOpen(false)}>Show results</button>
        </div>
      </Sheet>
    </>
  ) : null;

  const groupedResults = catalogueMode && !normalizedQuery && selectedRole === 'all'
    ? BATTLEFIELD_ROLES.map((role) => ({ role, items: visibleDatasheets.filter((sheet) => getListItemRole(sheet) === role) })).concat([{ role: 'other' as const, items: visibleDatasheets.filter((sheet) => getListItemRole(sheet) === 'other') }]).filter((group) => group.items.length > 0)
    : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        {supplement.tabs.length > 0 ? (
          <DatasheetSupplementTabs
            tabs={supplement.tabs}
            activeValue={supplement.selected}
            onChange={setSelectedSupplement}
          />
        ) : null}

        <Search
          label="Search datasheets"
          value={query}
          onChange={setQuery}
          placeholder={searchPlaceholder}
          testId="datasheet-search"
          className="w-full"
          clearable
          clearTestId="datasheet-search-clear"
        />
        {supplement.summary ? (
          <span className="text-xs text-subtle" data-testid="supplement-summary">
            {supplement.summary}
          </span>
        ) : null}
        {roleTabs ? (
          <PillTabs
            tabs={roleTabs}
            active={selectedRole}
            onChange={setSelectedRole}
            ariaLabel="Datasheet roles"
            testIdPrefix="datasheet-role"
          />
        ) : null}
        {catalogueControls}
        {showItemCount ? (
          <span className="text-sm text-subtle">
            Showing {visibleDatasheets.length} of {filteredBySettings.length} datasheets
            {supplement.isFiltered ? ` (from ${datasheets.length} total)` : ''}
          </span>
        ) : null}
      </div>

      {visibleDatasheets.length > 0 ? (
        renderDatasheet ? (
          <div
            className={cx('flex flex-col gap-2', resultsClassName)}
            aria-live="polite"
            id="datasheet-results"
            data-testid="datasheet-results"
          >
            {groupedResults ? groupedResults.map((group) => <section key={group.role} className="flex flex-col gap-2" aria-labelledby={`datasheet-group-${group.role}`}><h2 id={`datasheet-group-${group.role}`} className="pt-2 text-sm font-semibold uppercase tracking-wide text-subtle">{BATTLEFIELD_ROLE_LABELS[group.role]}</h2>{group.items.map((datasheet) => <div key={datasheet.slug} id={datasheet.id}>{renderItem(datasheet)}</div>)}</section>) : resultItems}
          </div>
        ) : (
          <Grid
            data-testid="datasheet-results"
            id="datasheet-results"
            className={resultsClassName}
            aria-live="polite"
          >
            {resultItems}
          </Grid>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center text-subtle">
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  );
};
