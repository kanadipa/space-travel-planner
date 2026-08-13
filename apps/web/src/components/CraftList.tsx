import { useState } from 'react';
import type { Evaluation, Failure, Spacecraft } from '../types';
import { distance, percent, temperature, years } from '../format';
import styles from './CraftList.module.css';

interface Props {
  evaluations: Evaluation[];
  fleet: Spacecraft[];
  /**
   * Craft already committed to another saved mission over this window.
   *
   * Separate from the failure list on purpose: those craft cannot fly the route at
   * all, whereas these could if the dates were different. They stay selectable so
   * the chip explains the dead save button, rather than the craft vanishing from a
   * list it was in a moment ago.
   */
  busyIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * A short name for a failure, read from the structured `detail` rather than by
 * parsing the message, so the chip and the sentence behind it cannot disagree.
 */
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
  /** Null until the agent says otherwise, so the default can follow the answer. */
  const [openedByHand, setOpenedByHand] = useState<boolean | null>(null);

  const byId = new Map(fleet.map((craft) => [craft.id, craft]));
  const feasible = evaluations.filter((evaluation) => evaluation.feasible);
  const ruledOut = evaluations.filter((evaluation) => !evaluation.feasible);
  /* Open when there is no answer to show: the reasons are the only thing left to
     read, and folding them away would hide the whole screen's content. */
  const showRuledOut = openedByHand ?? feasible.length === 0;
  /* No fallback: if every feasible craft is committed, nothing here can be saved
     and a recommendation would only walk the agent into the refusal. */
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
          const busy = busyIds.includes(craft.id);

          return (
            <li key={craft.id}>
              <button
                type="button"
                className={`${styles.row} ${chosen ? styles.rowOn : ''}`}
                onClick={() => onSelect(craft.id)}
                aria-pressed={chosen}
              >
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>{craft.name}</span>
                  {/* Says the state in words, not only in tint. */}
                  {chosen && <span className={styles.chosen}>chosen</span>}
                  {/* The evaluator returns feasible craft with the most range to
                      spare first, so the recommendation is the first one that can
                      actually be saved — recommending a craft whose save button is
                      dead would send the agent straight into the refusal. */}
                  {craft.id === recommendedId && <span className={styles.badge}>Recommended</span>}
                  {busy && (
                    <span
                      className={styles.busy}
                      title="Already committed to another saved mission over these dates. Move the departure date to free it."
                    >
                      already booked
                    </span>
                  )}
                </span>
                <span className={styles.specs}>
                  {craft.capacity} seats · {percent(evaluation.rangeUtilisation)} used ·{' '}
                  {years(evaluation.durationYears)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Folded away rather than dropped: the reasons matter when nothing fits,
          and are noise when something does. */}
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
                  <li key={craft.id} className={styles.rejected}>
                    <span className={styles.rejectedTop}>
                      <span className={styles.rejectedName}>{craft.name}</span>

                      <span className={styles.reasons}>
                        {evaluation.failures.map((failure, index) => (
                          <span
                            key={`${failure.code}-${index}`}
                            className={failure.actionable ? styles.stampWarn : styles.stampBad}
                            tabIndex={0}
                          >
                            {reasonFor(failure)}
                            <i className={styles.info} aria-hidden="true">
                              i
                            </i>
                            <span className={styles.tip} role="tooltip">
                              {failure.message}
                            </span>
                          </span>
                        ))}
                      </span>
                    </span>

                    <span className={styles.rejectedSpecs}>
                      {craft.size} · {craft.capacity} seats · {distance(craft.rangeKm)} range ·{' '}
                      {temperature(craft.operationalTemperatureCMin)} to{' '}
                      {temperature(craft.operationalTemperatureCMax)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
