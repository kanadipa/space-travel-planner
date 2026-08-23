import { Notice, type Tone } from './Notice';
import styles from './SavePanel.module.css';

/** Shown before the save is attempted, from the evaluation's `busySpacecraftIds`. */
const ALREADY_BOOKED =
  'This spacecraft is already committed to another mission over these dates. ' +
  'Choose another craft, or move the departure date.';

interface Props {
  /** Null until a feasible craft is picked, which is what the save needs. */
  hasCraft: boolean;
  craftIsBusy: boolean;
  amending: boolean;
  busy: boolean;
  error: { tone: Tone; messages: string[] } | null;
  onSave: () => void;
}

export function SavePanel({ hasCraft, craftIsBusy, amending, busy, error, onSave }: Props) {
  return (
    <section className={styles.panel}>
      <div>
        <p className={styles.hint}>
          {hasCraft
            ? 'The server revalidates the whole mission before it is stored.'
            : 'Choose a feasible spacecraft to save this mission.'}
        </p>

        {craftIsBusy && <Notice tone="scheduling" messages={[ALREADY_BOOKED]} />}
        {error && <Notice tone={error.tone} messages={error.messages} />}
      </div>

      <button
        type="button"
        className={styles.primary}
        onClick={onSave}
        disabled={!hasCraft || craftIsBusy || busy}
      >
        {amending ? 'Update mission' : 'Save mission'}
      </button>
    </section>
  );
}
