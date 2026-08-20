import styles from './Metric.module.css';

interface Props {
  label: string;
  value: string;
  hint?: string;
}

export function Metric({ label, value, hint }: Props) {
  return (
    <div className={styles.metric}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}
