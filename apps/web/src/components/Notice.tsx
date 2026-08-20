import styles from './Notice.module.css';

/** The API's two refusals: `scheduling` is 409 (amber), `physics` is 422 (red). */
export type Tone = 'scheduling' | 'physics';

interface Props {
  tone: Tone;
  messages: string[];
}

export function Notice({ tone, messages }: Props) {
  if (messages.length === 0) return null;

  return (
    <ul className={`${styles.notice} ${styles[tone]}`}>
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}
