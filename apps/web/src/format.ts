/** Distances run to billions of km, so raw digits are unreadable. */
export function distance(km: number): string {
  if (km >= 1e9) return `${(km / 1e9).toFixed(2)} B km`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(1)} M km`;
  return `${Math.round(km).toLocaleString('en-GB')} km`;
}

export function years(value: number): string {
  if (value < 1) return `${(value * 12).toFixed(1)} months`;
  return `${value.toFixed(2)} yr`;
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

/**
 * Renders a date that may be centuries away.
 *
 * Missions run for years, so a saved plan's arrival can fall outside the range a
 * locale short-date makes obvious. The year is always shown.
 */
export function longDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
