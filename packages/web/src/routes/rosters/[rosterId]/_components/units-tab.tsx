import React, { useMemo } from 'react';
import type { depot } from '@depot/core';
import { getRosterBattlefieldRole, validateRoster } from '@depot/core/utils/roster-legality';
import { BATTLEFIELD_ROLES, BATTLEFIELD_ROLE_LABELS } from '@depot/core/utils/datasheets';
import { RosterEmptyState, RosterSection } from '@/components/shared';
import ViewRosterUnitCard from './view-roster-unit-card';

interface UnitsTabProps {
  roster: depot.Roster;
}

const UnitsTab: React.FC<UnitsTabProps> = ({ roster }) => {
  const { units } = roster;

  const sections = useMemo(() => {
    const byRole = new Map<string, depot.RosterUnit[]>();
    for (const unit of units) {
      const role = getRosterBattlefieldRole(unit, roster);
      byRole.set(role, [...(byRole.get(role) ?? []), unit]);
    }
    return BATTLEFIELD_ROLES.filter((role) => byRole.has(role)).map((role) => {
      const grouped = [...byRole.get(role)!].sort((a, b) =>
        a.datasheet.name.localeCompare(b.datasheet.name)
      );
      return {
        role,
        units: grouped,
        points: grouped.reduce((sum, unit) => sum + (parseInt(unit.modelCost.cost, 10) || 0), 0)
      };
    });
  }, [roster, units]);

  // Legality issues carry an optional unitId — surface those on the unit itself
  // rather than only in the roster-level summary.
  const issuesByUnit = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of validateRoster(roster)) {
      if (!issue.unitId) continue;
      map.set(issue.unitId, [...(map.get(issue.unitId) ?? []), issue.message]);
    }
    return map;
  }, [roster]);

  const enhancementsByUnit = useMemo(
    () => new Map(roster.enhancements.map((entry) => [entry.unitId, entry.enhancement.name])),
    [roster.enhancements]
  );

  if (units.length === 0) {
    return <RosterEmptyState title="No units in this roster" dataTestId="empty-roster-message" />;
  }

  return (
    <div className="flex flex-col gap-4" data-testid="units-tab">
      {sections.map(({ role, units: grouped, points }) => (
        <RosterSection
          key={role}
          title={BATTLEFIELD_ROLE_LABELS[role]}
          count={`${grouped.length} · ${points} PTS`}
        >
          <div className="flex flex-col gap-4">
            {grouped.map((unit) => (
              <ViewRosterUnitCard
                key={unit.id}
                unit={unit}
                isWarlord={roster.warlordUnitId === unit.id}
                enhancementName={enhancementsByUnit.get(unit.id)}
                attachedToUnitName={
                  roster.units.find((target) => target.id === unit.attachedToUnitId)?.datasheet.name
                }
                issues={issuesByUnit.get(unit.id)}
              />
            ))}
          </div>
        </RosterSection>
      ))}
    </div>
  );
};

export default UnitsTab;
