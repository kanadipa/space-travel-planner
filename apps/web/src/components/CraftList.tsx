import { useState } from 'react';
import type { Evaluation, Failure, Spacecraft } from '../interfaces/types';
import { distance, duration, percent, temperature } from '../format';
import { CraftRow, GravityPill } from './CraftRow';
import { Pill } from './Pill';
import styles from './CraftList.module.css';

interface Props {
  evaluations: Evaluation[];
  fleet: Spacecraft[];
  busyIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ALREADY_BOOKED =
  'Already committed to another saved mission over these dates. Move the departure date to free it.';

/** The short label on a stamp. The server's full sentence goes in the tooltip. */
function reasonFor(failure: Failure): string {
  switch (failure.code) {
    case 'CAPACITY_EXCEEDED':
      return 'Capacity exceeded';
    case 'OUT_OF_RANGE':
      return 'Insufficient range';
    case 'EXCEEDS_MISSION_WINDOW':
      return 'Exceeds mission window';
    case 'TEMPERATURE_OUT_OF_BOUNDS':
      return Number(failure.detail.planetTemperatureC) > Number(failure.detail.maxC)
        ? 'Above temperature limit'
        : 'Below temperature limit';
  }
}

export function CraftList({ evaluations, fleet, busyIds, selectedId, onSelect }: Props) {
  const [openedByHand, setOpenedByHand] = useState<boolean | null>(null);

  const byId = new Map(fleet.map((craft) => [craft.id, craft]));
  const feasible = evaluations.filter((evaluation) => evaluation.feasible);
  const ruledOut = evaluations.filter((evaluation) => !evaluation.feasible);

  const showRuledOut = openedByHand ?? feasible.length === 0;
  const recommendedId = feasible.find((e) => !busyIds.includes(e.spacecraftId))?.spacecraftId;

  return (
    <section className={styles.section} aria-labelledby="craft-heading">
      <header className={styles.header}>
        <h2 id="craft-heading">Spacecraft</h2>
        <span className={styles.count}>
          {feasible.length} of {evaluations.length} can fly this route
        </span>
      </header>

      {feasible.length === 0 && evaluations.length > 0 && (
        <p className={styles.empty}>
          Nothing in the fleet can fly this route. Reduce the party size or remove a destination —
          fewer passengers lowers consumption, which increases reach.
        </p>
      )}

      <ul className={styles.list}>
        {feasible.map((evaluation) => {
          const craft = byId.get(evaluation.spacecraftId);
          if (!craft) return null;

          const chosen = selectedId === craft.id;

          return (
            <CraftRow
              key={craft.id}
              craft={craft}
              selected={chosen}
              onSelect={() => onSelect(craft.id)}
              pills={
                <>
                  {craft.id === recommendedId && <Pill tone="accent">Recommended</Pill>}
                  <GravityPill craft={craft} />
                  {busyIds.includes(craft.id) && (
                    <Pill tone="warn" tip={ALREADY_BOOKED}>
                      already booked
                    </Pill>
                  )}
                </>
              }
              specs={
                <>
                  {craft.capacity} seats · {percent(evaluation.rangeUtilisation)} used ·{' '}
                  {duration(evaluation.durationYears)}
                </>
              }
            />
          );
        })}
      </ul>

      {ruledOut.length > 0 && (
        <div className={styles.ruledOut}>
          <button
            type="button"
            className={styles.disclosure}
            onClick={() => setOpenedByHand(!showRuledOut)}
            aria-expanded={showRuledOut}
          >
            {showRuledOut
              ? `Hide the ${ruledOut.length} ruled out ↑`
              : `Why ${ruledOut.length} are ruled out ↓`}
          </button>

          {showRuledOut && (
            <ul className={styles.list}>
              {ruledOut.map((evaluation) => {
                const craft = byId.get(evaluation.spacecraftId);
                if (!craft) return null;

                return (
                  <CraftRow
                    key={craft.id}
                    craft={craft}
                    pills={
                      <>
                        <GravityPill craft={craft} />
                        {evaluation.failures.map((failure, index) => (
                          <Pill
                            key={`${failure.code}-${index}`}
                            tone={failure.actionable ? 'warn' : 'bad'}
                            tip={failure.message}
                          >
                            {reasonFor(failure)}
                          </Pill>
                        ))}
                      </>
                    }
                    specs={
                      <>
                        {craft.size} · {craft.capacity} seats · {distance(craft.rangeKm)} range ·{' '}
                        {temperature(craft.operationalTemperatureCMin)} to{' '}
                        {temperature(craft.operationalTemperatureCMax)}
                      </>
                    }
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
