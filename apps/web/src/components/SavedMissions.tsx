import type { Mission } from '../types';
import { distance, longDate, years } from '../format';
import styles from './SavedMissions.module.css';

interface Props {
  missions: Mission[];
  activeId: string | null;
  onLoad: (mission: Mission) => void;
  onDelete: (id: string) => void;
}

/**
 * A list, not just a reference lookup.
 *
 * "Loading of individual mission plans" implies the agent can find one again; a
 * bare code field would be a dead end for anyone who lost the code.
 */
export function SavedMissions({ missions, activeId, onLoad, onDelete }: Props) {
  return (
    <section className={styles.section} aria-labelledby="saved-heading">
      <header className={styles.header}>
        <h2 id="saved-heading">Saved missions</h2>
        <span className={styles.count}>{missions.length}</span>
      </header>

      {missions.length === 0 ? (
        <p className={styles.empty}>
          Nothing saved yet. Configure a mission and save it to see it here.
        </p>
      ) : (
        <ul className={styles.list}>
          {missions.map((mission) => (
            <li
              key={mission.id}
              className={`${styles.row} ${activeId === mission.id ? styles.active : ''}`}
            >
              <button type="button" className={styles.main} onClick={() => onLoad(mission)}>
                <span className={styles.reference}>{mission.reference}</span>
                <span className={styles.name}>{mission.name}</span>
                <span className={styles.meta}>
                  {longDate(mission.departureDate)} → {longDate(mission.arrivalDate)} ·{' '}
                  {years(mission.durationYears)} · {distance(mission.totalDistanceKm)} ·{' '}
                  {mission.spacecraftSnapshot.name}
                </span>
              </button>
              <button
                type="button"
                className={styles.delete}
                onClick={() => onDelete(mission.id)}
                aria-label={`Delete mission ${mission.reference}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
