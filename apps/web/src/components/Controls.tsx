import { useState } from 'react';
import type { Planet } from '../interfaces/types';
import styles from './Controls.module.css';

/**
 * Lowercases only the leading character so the reason reads as a clause.
 */
function uncapitalise(sentence: string): string {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

function PassengerField({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    setDraft(null);
  }

  function commit() {
    const parsed = Number.parseInt(draft ?? '', 10);
    if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(1, parsed)));
    setDraft(null);
  }

  return (
    <input
      className={styles.readout}
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      aria-labelledby="pax-label"
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') setDraft(null);
      }}
    />
  );
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
            <PassengerField value={passengerCount} max={maxCapacity} onChange={onPassengerCount} />
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
