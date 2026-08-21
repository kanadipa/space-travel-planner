import { isoDate } from '../format';

/** Must match `HOURS_PER_YEAR` in the API's `domain/constants.ts`. */
const HOURS_PER_YEAR = 365.25 * 24;

const MS_PER_HOUR = 3_600_000;

/** The supplied data carries no epoch and missions run for years. */
export function defaultDepartureDate(): string {
  const now = new Date();
  return isoDate(new Date(Date.UTC(2041, now.getUTCMonth(), now.getUTCDate())));
}

/** When a mission leaving on `departure` gets home. Formatting is the caller's job. */
export function arrivalAfter(departure: string, durationYears: number): Date {
  const start = new Date(departure);
  return new Date(start.getTime() + durationYears * HOURS_PER_YEAR * MS_PER_HOUR);
}
