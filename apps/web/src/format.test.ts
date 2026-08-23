import { describe, expect, it } from 'vitest';
import {
  consumption,
  distance,
  duration,
  isoDate,
  percent,
  radiation,
  temperature,
} from './format';

describe('duration', () => {
  /*
   * The regression this file was written for. Rounding a year to a whole 365 days
   * makes it shorter than the 365.25 it was divided by, so one year came back as
   * "11 mo 30 d".
   */
  it('reads a whole year as a year', () => {
    expect(duration(1)).toBe('1 yr');
    expect(duration(2)).toBe('2 yr');
    expect(duration(3)).toBe('3 yr');
  });

  it('drops the parts that are zero', () => {
    expect(duration(1.5)).toBe('1 yr 6 mo');
  });

  it('keeps all three when all three are there', () => {
    expect(duration(2.6)).toBe('2 yr 7 mo 6 d');
  });

  it('falls back to months and days under a year', () => {
    expect(duration(0.25)).toBe('3 mo');
    expect(duration(0.08)).toBe('29 d');
  });

  /* A day count that rounds up to a full month must carry, not read "1 mo 30 d". */
  it('carries days into months and months into years', () => {
    expect(duration(0.0833)).toBe('1 mo');
    expect(duration(0.9986)).toBe('1 yr');
  });

  it('says so rather than showing nothing at zero', () => {
    expect(duration(0)).toBe('under a day');
  });

  it('does not render a negative duration', () => {
    expect(duration(-1)).toBe('under a day');
  });
});

describe('distance', () => {
  it('switches unit at a billion and a million', () => {
    expect(distance(2_400_000_000)).toBe('2.40 B km');
    expect(distance(54_600_000)).toBe('54.6 M km');
    expect(distance(384_400)).toBe('384,400 km');
  });

  /* Exactly on a boundary takes the larger unit, so 1e9 is never "1000.0 M km". */
  it('takes the larger unit on the boundary', () => {
    expect(distance(1e9)).toBe('1.00 B km');
    expect(distance(1e6)).toBe('1.0 M km');
  });

  it('handles zero', () => {
    expect(distance(0)).toBe('0 km');
  });
});

describe('percent', () => {
  it('rounds to whole percent', () => {
    expect(percent(0.436)).toBe('44%');
    expect(percent(0)).toBe('0%');
    expect(percent(1)).toBe('100%');
  });

  /* Range used can exceed the range: the figure is why the craft is ruled out. */
  it('does not clamp above 100', () => {
    expect(percent(2.5)).toBe('250%');
  });
});

describe('temperature and radiation', () => {
  it('keeps the unit casing that reads correctly', () => {
    expect(temperature(-65)).toBe('-65 °C');
    expect(radiation(2000)).toBe('2,000 mSv');
  });

  it('renders zero rather than dropping it', () => {
    expect(temperature(0)).toBe('0 °C');
    expect(radiation(0)).toBe('0 mSv');
  });
});

describe('consumption', () => {
  it('keeps three decimals, since the rate moves in thousandths', () => {
    expect(consumption(1)).toBe('1.000');
    expect(consumption(1.168)).toBe('1.168');
  });
});

describe('isoDate', () => {
  it('takes a date or the string one arrived as', () => {
    expect(isoDate(new Date('2041-03-01T00:00:00Z'))).toBe('2041-03-01');
    expect(isoDate('2041-03-01T12:34:56.000Z')).toBe('2041-03-01');
  });
});
