import type { ReactNode } from 'react';
import type { Spacecraft } from '../interfaces/types';
import { Pill } from './Pill';
import styles from './CraftList.module.css';

const GRAVITY_GENERATOR =
  'Carries a gravity generator, so the party is not weightless for the trip.';

/** Shown on both halves of the list: it is a property of the craft, not of the route. */
export function GravityPill({ craft }: { craft: Spacecraft }) {
  if (!craft.gravityGenerator) return null;

  return (
    <Pill tone="star" tip={GRAVITY_GENERATOR}>
      <span aria-hidden="true">★</span> gravity
    </Pill>
  );
}

interface Props {
  craft: Spacecraft;
  pills: ReactNode;
  specs: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
}

/**
 * One row for both halves of the list. Selectable when `onSelect` is given, which
 * is the only thing that actually differs — a ruled-out craft is not a choice.
 */
export function CraftRow({ craft, pills, specs, selected, onSelect }: Props) {
  const inner = (
    <>
      {/* Name over its own numbers on the left; the pills gather on the right, so
          the column of labels stays scannable down the list. */}
      <span className={styles.rowText}>
        <span className={styles.rowName}>{craft.name}</span>
        <span className={styles.specs}>{specs}</span>
      </span>
      <span className={styles.rowPills}>{pills}</span>
    </>
  );

  if (!onSelect) return <li className={`${styles.row} ${styles.rowOff}`}>{inner}</li>;

  return (
    <li>
      <button
        type="button"
        className={`${styles.row} ${selected ? styles.rowOn : ''}`}
        onClick={onSelect}
        aria-pressed={selected}
      >
        {inner}
      </button>
    </li>
  );
}
