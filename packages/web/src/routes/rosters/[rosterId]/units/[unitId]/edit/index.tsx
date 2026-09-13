import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from '@/lib/navigation';
import type { depot } from '@depot/core';

import { RosterProvider } from '@/contexts/roster/context';
import { useRoster } from '@/contexts/roster/context';
import { useToast } from '@/contexts/toast/context';

import AppLayout from '@/components/layout';
import { ErrorState, PageHeaderSkeleton, SectionHeader, SkeletonCard } from '@/components/ui';
import UnitEditShell from '@/components/shared/unit-edit/unit-edit-shell';
import type { UnitAttachmentTarget, UnitEditSelection } from '@/components/shared/unit-edit/unit-edit-shell';
import EnhancementSelection from './_components/enhancement-selection';
import WarlordSelection from './_components/warlord-selection';
import { isCharacter } from '@depot/core/utils/datasheets';
import { getRosterFactionName } from '@depot/core/utils/roster';
import { getUnitAttachmentEligibility } from '@depot/core/utils/roster';
import { getEligibleEnhancements, getUnitOrdinal } from '@depot/core/utils/roster-legality';
import { modelCostsForOrdinal } from '@depot/core/utils/model-costs';

/** Keyed by unit id by the caller, so state initialises once per unit. */
const EditRosterUnitForm: React.FC<{ unit: depot.RosterUnit }> = ({ unit }) => {
  const {
    state: roster,
    updateUnitWargear,
    updateUnitWargearAbilities,
    updateUnitModelCost,
    setUnitAttachment,
    applyEnhancement,
    removeEnhancement,
    setWarlord
  } = useRoster();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const unitId = unit.id;
  const unitHash = `#unit-${unitId}`;

  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>(() =>
    roster.enhancements.filter((e) => e.unitId === unitId).map((e) => e.enhancement.id)
  );
  const [isWarlord, setIsWarlord] = useState(() => roster.warlordUnitId === unitId);

  const factionName = getRosterFactionName(roster);
  const character = isCharacter(unit.datasheet);
  const eligibleEnhancements = getEligibleEnhancements(unit, roster);
  const attachmentTargets: UnitAttachmentTarget[] = (() => {
    if (unit.datasheet.leaders.length === 0) return [];
    const compatible = roster.units.filter(
      (target) => getUnitAttachmentEligibility(roster, unit.id, target.id).eligible
    );
    const counts = new Map<string, number>();
    compatible.forEach((target) => counts.set(target.datasheet.name, (counts.get(target.datasheet.name) ?? 0) + 1));
    const seen = new Map<string, number>();
    return compatible.map((target) => {
      const count = counts.get(target.datasheet.name) ?? 0;
      const occurrence = (seen.get(target.datasheet.name) ?? 0) + 1;
      seen.set(target.datasheet.name, occurrence);
      return {
        unit: target,
        label: count > 1 ? `${target.datasheet.name} · Unit ${occurrence}` : target.datasheet.name
      };
    });
  })();

  const handleSave = ({
    selectedWargear,
    selectedWargearAbilities,
    selectedModelCost,
    attachedToUnitId
  }: UnitEditSelection) => {
    try {
      // Update unit wargear
      updateUnitWargear(unitId, selectedWargear);
      updateUnitWargearAbilities(unitId, selectedWargearAbilities);
      if (unit.datasheet.leaders.length > 0) {
        setUnitAttachment(unitId, attachedToUnitId ?? null);
      }

      // Handle enhancements - first remove existing ones for this unit
      const existingEnhancements = roster.enhancements.filter((e) => e.unitId === unitId);
      existingEnhancements.forEach((e) => removeEnhancement(e.enhancement.id));

      // Then apply new enhancements
      selectedEnhancements.forEach((enhancementId) => {
        const enhancement = eligibleEnhancements.find((e) => e.id === enhancementId);
        if (enhancement) {
          applyEnhancement(enhancement, unitId);
        }
      });

      // Update model cost if changed
      if (selectedModelCost && selectedModelCost !== unit.modelCost) {
        updateUnitModelCost(unitId, selectedModelCost);
      }

      if (isWarlord) {
        setWarlord(unitId);
      } else if (roster.warlordUnitId === unitId) {
        setWarlord(null);
      }

      showToast({
        type: 'success',
        title: 'Unit Updated',
        message: 'Unit configuration has been saved successfully.'
      });

      navigate(`/rosters/${roster.id}/edit${unitHash}`);
    } catch (error) {
      console.error('Failed to save unit changes:', error);
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save unit changes. Please try again.'
      });
    }
  };

  const subtitle = `Loadout · ${factionName || roster.name}`;
  const documentTitle = `${unit.datasheet.name} - Edit Roster Unit`;

  return (
    <UnitEditShell
      unit={unit}
      testId="edit-unit-form"
      backTo={`/rosters/${roster.id}/edit${unitHash}`}
      documentTitle={documentTitle}
      backLabel={roster.name}
      title={unit.datasheet.name}
      subtitle={subtitle}
      modelCosts={modelCostsForOrdinal(
        unit.datasheet.modelCosts,
        getUnitOrdinal(roster.units, unit.id)
      )}
      afterGrid={
        <>
          {character || eligibleEnhancements.length > 0 ? (
            <section className="flex flex-col gap-1.5" data-testid="enhancement-section">
              <SectionHeader title={character ? 'Enhancement' : 'Upgrade'} />
              <EnhancementSelection
                enhancements={eligibleEnhancements}
                selectedEnhancements={selectedEnhancements}
                onEnhancementChange={setSelectedEnhancements}
              />
            </section>
          ) : null}

          {character ? (
            <section className="flex flex-col gap-1.5" data-testid="warlord-section">
              <SectionHeader title="Warlord" />
              <WarlordSelection
                unit={unit}
                roster={roster}
                isWarlord={isWarlord}
                onWarlordChange={setIsWarlord}
              />
            </section>
          ) : null}
        </>
      }
      attachmentTargets={attachmentTargets}
      onSave={handleSave}
    />
  );
};

const EditRosterUnitView: React.FC = () => {
  const { state: roster } = useRoster();
  const { rosterId, unitId } = useParams<{ rosterId: string; unitId: string }>();
  const unit = roster.units.find((u) => u.id === unitId);

  // Loading state while roster loads
  if (!roster.id) {
    return (
      <AppLayout
        title="Edit Roster Unit"
        back={{ to: `/rosters/${rosterId}/edit`, label: 'Roster' }}
      >
        <div className="flex flex-col gap-4" data-testid="edit-unit-loading">
          <PageHeaderSkeleton />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppLayout>
    );
  }

  // Error state if unit not found
  if (!unit) {
    return (
      <AppLayout
        title="Edit Roster Unit"
        back={{ to: `/rosters/${rosterId}/edit`, label: 'Roster' }}
      >
        <ErrorState
          title="Unit Not Found"
          message="The unit you're trying to edit could not be found."
          showRetry={false}
          homeUrl={`/rosters/${rosterId}/edit`}
          data-testid="edit-unit-not-found"
        />
      </AppLayout>
    );
  }

  return <EditRosterUnitForm key={unit.id} unit={unit} />;
};

const EditRosterUnitPage: React.FC = () => {
  const { rosterId } = useParams<{ rosterId: string }>();

  return (
    <RosterProvider rosterId={rosterId}>
      <EditRosterUnitView />
    </RosterProvider>
  );
};

export default EditRosterUnitPage;
