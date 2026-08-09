import type { Evaluation, Failure, Spacecraft } from '../types';
import { distance, percent, temperature, years } from '../format';
import styles from './CraftList.module.css';

interface Props {
  evaluations: Evaluation[];
  fleet: Spacecraft[];
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

export function CraftList({ evaluations, fleet, selectedId, onSelect }: Props) {
  const byId = new Map(fleet.map((craft) => [craft.id, craft]));
  const feasible = evaluations.filter((evaluation) => evaluation.feasible);
  const ruledOut = evaluations.filter((evaluation) => !evaluation.feasible);

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
        {feasible.map((evaluation, index) => {
          const craft = byId.get(evaluation.spacecraftId);
          if (!craft) return null;

          const chosen = selectedId === craft.id;

          return (
            <li key={craft.id}>
              <button
                type="button"
                className={`${styles.row} ${chosen ? styles.rowOn : ''}`}
                onClick={() => onSelect(craft.id)}
                aria-pressed={chosen}
              >
                <span className={styles.rowName}>{craft.name}</span>
                {/* The evaluator returns feasible craft with the most range to
                    spare first, so the recommendation is simply the first one. */}
                {index === 0 && <span className={styles.badge}>Recommended</span>}
                <span className={styles.chip}>{craft.capacity} seats</span>
                <span className={styles.chip}>{percent(evaluation.rangeUtilisation)} used</span>
                <span className={styles.chip}>{years(evaluation.durationYears)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {ruledOut.length > 0 && (
        <>
          <h3 className={styles.divider}>
            <span>ruled out</span>
          </h3>
          <ul className={styles.list}>
            {ruledOut.map((evaluation) => {
              const craft = byId.get(evaluation.spacecraftId);
              if (!craft) return null;

              return (
                <li key={craft.id} className={styles.rejected}>
                  <span className={styles.rejectedTop}>
                    <span className={styles.rejectedName}>{craft.name}</span>

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

                  <span className={styles.rejectedSpecs}>
                    {craft.size} · {craft.capacity} seats · {distance(craft.rangeKm)} range ·{' '}
                    {temperature(craft.operationalTemperatureCMin)} to{' '}
                    {temperature(craft.operationalTemperatureCMax)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
