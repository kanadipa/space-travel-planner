import type { Planet } from '../types';
import styles from './Controls.module.css';

/**
 * Lowercases only the leading character so the reason reads as a clause
 * after the npbody name.
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
