/** Distances run to billions of km, so raw digits are unreadable. */
export function distance(km: number): string {
  if (km >= 1e9) return `${(km / 1e9).toFixed(2)} B km`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(1)} M km`;
  return `${Math.round(km).toLocaleString('en-GB')} km`;
}

const DAYS_PER_MONTH = 365.25 / 12;
const WHOLE_MONTH = Math.round(DAYS_PER_MONTH);

/**
 * Split off the decimal year rather than off a day count: rounding a year to 365
 * days makes it shorter than the 365.25 it is divided by, and one year came back
 * as "11 mo 30 d". Days round up into a month, and months into a year.
 *
 * Expected outcome: "1 yr 3 mo 3 d", dropping the parts that are zero.
 */
export function duration(valueYears: number): string {
  let yr = Math.max(0, Math.floor(valueYears));
  const months = (Math.max(0, valueYears) - yr) * 12;
  let mo = Math.floor(months);
  let d = Math.round((months - mo) * DAYS_PER_MONTH);

  if (d >= WHOLE_MONTH) {
    mo += 1;
    d = 0;
  }
  if (mo >= 12) {
    yr += 1;
    mo = 0;
  }

  const parts = [];
  if (yr > 0) parts.push(`${yr} yr`);
  if (mo > 0) parts.push(`${mo} mo`);
  if (d > 0) parts.push(`${d} d`);

  return parts.length > 0 ? parts.join(' ') : 'under a day';
}

/** The rate itself; the unit it is per lives in the label beside it. */
export function consumption(rate: number): string {
  return rate.toFixed(3);
}

export function radiation(millisieverts: number): string {
  return `${millisieverts.toLocaleString('en-GB')} mSv`;
}

export function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function temperature(celsius: number): string {
  return `${Math.round(celsius).toLocaleString('en-GB')} °C`;
}

export function isoDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

/** Missions run for years, so the year is always shown. */
export function longDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function years(value: number): string {
  if (value < 1) return `${(value * 12).toFixed(1)} months`;
  return `${value.toFixed(2)} yr`;
}
