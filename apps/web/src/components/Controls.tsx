import type { Planet } from '../types';
import { temperature } from '../format';
import styles from './Controls.module.css';

interface Props {
  destinations: Planet[];
  excluded: { body: Planet; reason: string }[];
  selectedIds: string[];
  passengerCount: number;
  departureDate: string;
  maxCapacity: number;
  onToggleDestination: (id: string) => void;
  onPassengerCount: (value: number) => void;
  onDepartureDate: (value: string) => void;
}

export function Controls({
  destinations,
  excluded,
  selectedIds,
  passengerCount,
  departureDate,
  maxCapacity,
  onToggleDestination,
  onPassengerCount,
  onDepartureDate,
}: Props) {
  return (
    <section className={styles.panel}>
      <div className={styles.row}>
        <label className={styles.label} htmlFor="pax">
          Passengers
        </label>
        <input
          id="pax"
          type="range"
          min={1}
          max={maxCapacity}
          step={1}
          value={passengerCount}
          onChange={(event) => onPassengerCount(Number(event.target.value))}
          className={styles.slider}
        />
        <output className={styles.readout}>{passengerCount}</output>

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

      <div className={styles.destinations}>
        <span className={styles.label}>Destinations</span>
        <div className={styles.chips}>
          {destinations.map((body) => {
            const active = selectedIds.includes(body.id);
            return (
              <button
                key={body.id}
                type="button"
                className={active ? styles.chipOn : styles.chip}
                onClick={() => onToggleDestination(body.id)}
                aria-pressed={active}
                title={`${temperature(body.averageTemperatureC)}${
                  body.weatherPatterns ? ` · ${body.weatherPatterns}` : ''
                }`}
              >
                {body.name}
                {body.potentiallyHabitable && <i className={styles.habitable} title="Habitable" />}
              </button>
            );
          })}
        </div>
      </div>

      {excluded.length > 0 && (
        <p className={styles.excluded}>
          Not offered:{' '}
          {excluded.map((entry, index) => (
            <span key={entry.body.id}>
              {index > 0 && ', '}
              <strong>{entry.body.name}</strong> — {entry.reason.toLowerCase()}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
