import { alpha, beta, fragile, gamma, inner, planets, workhorse } from './__fixtures__/planets';
import { canSurvive, selectableDestinations, unreachableBodies } from './destinations';

const fleet = [workhorse, fragile];
const furnace = { ...gamma, id: 'furnace', name: 'Furnace', averageTemperatureC: 5_505 };

describe('selectableDestinations', () => {
  it('excludes the departure planet', () => {
    expect(selectableDestinations(planets, fleet, alpha).map((p) => p.id)).not.toContain('alpha');
  });

  it('keeps bodies at least one craft can survive', () => {
    expect(selectableDestinations(planets, fleet, alpha).map((p) => p.id)).toEqual([
      'inner',
      'beta',
      'gamma',
    ]);
  });

  it('excludes bodies no craft in the fleet can survive', () => {
    expect(
      selectableDestinations([...planets, furnace], fleet, alpha).map((p) => p.id),
    ).not.toContain('furnace');
  });

  it('orders results by distance from the sun', () => {
    const ordered = selectableDestinations(planets, fleet, alpha);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i]!.distanceFromSunKm).toBeGreaterThan(ordered[i - 1]!.distanceFromSunKm);
    }
  });
});

describe('unreachableBodies', () => {
  it('explains why a body was excluded', () => {
    const [excluded] = unreachableBodies([...planets, furnace], fleet, alpha);
    expect(excluded?.body.id).toBe('furnace');
    expect(excluded?.reason).toContain('5505');
  });

  it('is empty when the fleet covers everything', () => {
    expect(unreachableBodies(planets, fleet, alpha)).toHaveLength(0);
  });
});

describe('canSurvive', () => {
  it('is inclusive at the bounds', () => {
    const atMin = { ...inner, averageTemperatureC: workhorse.operationalTemperatureCMin };
    const atMax = { ...beta, averageTemperatureC: workhorse.operationalTemperatureCMax };
    expect(canSurvive(workhorse, atMin)).toBe(true);
    expect(canSurvive(workhorse, atMax)).toBe(true);
  });
});
