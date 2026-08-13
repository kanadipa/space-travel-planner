import type { Planet } from '../types';
import styles from './Controls.module.css';

/**
 * Lowercases only the leading character so the reason reads as a clause after the
 * body name. Lowercasing the whole string would turn the unit `°C` into `°c`.
 */
function uncapitalise(sentence: string): string {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

interface Props {
  excluded: { body: Planet; reason: string }[];
  passengerCount: number;
  departureDate: string;
  maxCapacity: number;
  onPassengerCount: (value: number) => void;
  onDepartureDate: (value: string) => void;
}

/** Destinations are picked on the diagram; what is left here is the rest of the mission. */
export function Controls({
  excluded,
  passengerCount,
  departureDate,
  maxCapacity,
  onPassengerCount,
  onDepartureDate,
}: Props) {
  return (
    <section className={styles.panel}>
      <div className={styles.controls}>
        {/* Stepped rather than dragged: the figure is a head count, and the
            largest craft in the fleet is the ceiling. */}
        <div className={styles.field}>
          <span className={styles.label} id="pax-label">
            Passengers
          </span>
          <div className={styles.stepper}>
            <button
              type="button"
              className={styles.step}
              onClick={() => onPassengerCount(Math.max(1, passengerCount - 1))}
              disabled={passengerCount <= 1}
              aria-label="One fewer passenger"
            >
              –
            </button>
            <output className={styles.readout} aria-labelledby="pax-label">
              {passengerCount}
            </output>
            <button
              type="button"
              className={styles.step}
              onClick={() => onPassengerCount(Math.min(maxCapacity, passengerCount + 1))}
              disabled={passengerCount >= maxCapacity}
              aria-label="One more passenger"
            >
              +
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="departure">
            Departure
          </label>
          <input
            id="departure"
            type="date"
            value={departureDate}
            onChange={(event) => onDepartureDate(event.target.value)}
            className={styles.date}
          />
        </div>
      </div>

      {excluded.length > 0 && (
        <p className={styles.excluded}>
          Not offered:{' '}
          {excluded.map((entry, index) => (
            <span key={entry.body.id}>
              {index > 0 && ', '}
              <strong>{entry.body.name}</strong> — {uncapitalise(entry.reason)}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
