import type { Evaluation, Failure, Spacecraft } from '../types';
import { distance, percent, years } from '../format';
import styles from './CraftList.module.css';

interface Props {
  evaluations: Evaluation[];
  fleet: Spacecraft[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Actionable failures first, intrinsic ones last.
 *
 * The server already orders them; the UI keeps that order rather than sorting by
 * severity, because "what can I change" is the question an agent is asking.
 */
function failureTone(failure: Failure): string | undefined {
  return failure.actionable ? styles.warn : styles.bad;
}

export function CraftList({ evaluations, fleet, selectedId, onSelect }: Props) {
  const byId = new Map(fleet.map((craft) => [craft.id, craft]));
  const feasibleCount = evaluations.filter((e) => e.feasible).length;

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2>Spacecraft</h2>
        <span className={styles.count}>
          {feasibleCount} of {evaluations.length} can fly this route
        </span>
      </header>

      {feasibleCount === 0 && evaluations.length > 0 && (
        <p className={styles.empty}>
          Nothing in the fleet can fly this route. Reduce the party size or remove a destination —
          fewer passengers lowers consumption, which increases reach.
        </p>
      )}

      <ul className={styles.list}>
        {evaluations.map((evaluation) => {
          const craft = byId.get(evaluation.spacecraftId);
          if (!craft) return null;

          const selected = selectedId === craft.id;

          return (
            <li key={craft.id}>
              <button
                type="button"
                className={`${styles.card} ${evaluation.feasible ? '' : styles.disabled} ${
                  selected ? styles.selected : ''
                }`}
                onClick={() => evaluation.feasible && onSelect(craft.id)}
                aria-pressed={selected}
                disabled={!evaluation.feasible}
              >
                <div className={styles.top}>
                  <span className={styles.name}>{craft.name}</span>
                  <span className={evaluation.feasible ? styles.badgeOk : styles.badgeNo}>
                    {evaluation.feasible ? 'feasible' : 'excluded'}
                  </span>
                </div>

                <div className={styles.specs}>
                  {craft.size} · {craft.capacity} seats · {distance(craft.rangeKm)} range ·{' '}
                  {craft.operationalTemperatureCMin} to {craft.operationalTemperatureCMax} °C
                </div>

                {evaluation.feasible && (
                  <>
                    <div className={styles.barTrack}>
                      <div
                        className={
                          evaluation.rangeUtilisation > 0.9 ? styles.barWarn : styles.barOk
                        }
                        style={{ width: `${Math.min(100, evaluation.rangeUtilisation * 100)}%` }}
                      />
                    </div>
                    <div className={styles.stats}>
                      <span>{percent(evaluation.rangeUtilisation)} of range used</span>
                      <span>{years(evaluation.durationYears)}</span>
                    </div>
                  </>
                )}

                {evaluation.failures.length > 0 && (
                  <ul className={styles.failures}>
                    {evaluation.failures.map((failure, index) => (
                      <li key={`${failure.code}-${index}`} className={failureTone(failure)}>
                        {failure.message}
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
