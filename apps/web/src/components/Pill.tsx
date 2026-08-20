import type { ReactNode } from 'react';
import styles from './Pill.module.css';

/** Quiet and accent are bare labels; star, warn and bad are filled, matching Notice. */
type PillTone = 'quiet' | 'accent' | 'star' | 'warn' | 'bad';

interface Props {
  tone?: PillTone;
  /** The full sentence, on hover or focus. Its presence is what adds the marker. */
  tip?: string;
  children: ReactNode;
}

export function Pill({ tone = 'quiet', tip, children }: Props) {
  const className = `${styles.pill} ${styles[tone]}`;

  if (!tip) return <span className={className}>{children}</span>;

  return (
    <span className={`${className} ${styles.tipped}`} tabIndex={0}>
      {children}
      <i className={styles.marker} aria-hidden="true">
        i
      </i>
      <span className={styles.tip} role="tooltip">
        {tip}
      </span>
    </span>
  );
}
