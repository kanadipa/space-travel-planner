import { consumptionRate, durationYears, rangeConsumed } from './consumption';

describe('consumptionRate', () => {
  it('is the base rate with nobody aboard', () => {
    expect(consumptionRate(0)).toBe(1);
  });

  it('applies the passenger rate per head', () => {
    expect(consumptionRate(5)).toBeCloseTo(1.21, 10);
    expect(consumptionRate(10)).toBeCloseTo(1.42, 10);
  });

  it('increases strictly with passenger count', () => {
    const rates = [0, 1, 2, 3, 4, 5].map(consumptionRate);
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]!).toBeGreaterThan(rates[i - 1]!);
    }
  });
});

describe('rangeConsumed', () => {
  it('scales linearly with distance', () => {
    expect(rangeConsumed(2_000, 5)).toBeCloseTo(2 * rangeConsumed(1_000, 5), 6);
  });
});

describe('durationYears', () => {
  it('divides distance by speed and converts to years', () => {
    const oneYearOfTravel = 10_000 * 365.25 * 24;
    expect(durationYears(oneYearOfTravel, 10_000)).toBeCloseTo(1, 10);
  });
});
