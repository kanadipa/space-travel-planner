import { alpha, beta, gamma, inner, planets } from './__fixtures__/planets';
import { clearanceFor, detourFor } from './geometry';
import { buildItinerary, orderStops } from './route';

describe('orderStops', () => {
  it('returns out and back for a single destination', () => {
    expect(orderStops(alpha, [beta]).map((p) => p.id)).toEqual(['alpha', 'beta', 'alpha']);
  });

  it('visits outward destinations in ascending order and retraces', () => {
    expect(orderStops(alpha, [gamma, beta]).map((p) => p.id)).toEqual([
      'alpha',
      'beta',
      'gamma',
      'beta',
      'alpha',
    ]);
  });

  it('sweeps outward before inward when destinations straddle the departure', () => {
    expect(orderStops(alpha, [beta, inner]).map((p) => p.id)).toEqual([
      'alpha',
      'beta',
      'alpha',
      'inner',
      'alpha',
    ]);
  });

  it('ignores the departure planet listed as a destination', () => {
    expect(orderStops(alpha, [alpha, beta]).map((p) => p.id)).toEqual(['alpha', 'beta', 'alpha']);
  });

  it('deduplicates repeated destinations', () => {
    expect(orderStops(alpha, [beta, beta]).map((p) => p.id)).toEqual(['alpha', 'beta', 'alpha']);
  });
});

describe('buildItinerary', () => {
  it('charges no detour at a turnaround', () => {
    const itinerary = buildItinerary(alpha, [beta], planets);
    // alpha -> beta -> alpha, nothing in between, beta is the turnaround
    expect(itinerary.legs.every((leg) => leg.detourKm === 0)).toBe(true);
    expect(itinerary.totalDistanceKm).toBe(1_400);
  });

  it('charges a detour for a body flown past in transit', () => {
    const itinerary = buildItinerary(alpha, [gamma], planets);
    const [outbound] = itinerary.legs;
    expect(outbound?.passedPlanetIds).toEqual(['beta']);
    // The arc less the crossing: the surface span already runs through beta.
    expect(outbound?.detourKm).toBeCloseTo(clearanceFor(beta), 6);
  });

  /* Computed by hand from the fixtures: alpha's surface at 1100, out to beta's
     near face at 1800, over beta, on from 2200 to gamma's near face at 2950. */
  it('measures a fly-past leg the long way round the body, and no further', () => {
    const [outbound] = buildItinerary(alpha, [gamma], planets).legs;
    expect(outbound?.distanceKm).toBeCloseTo(700 + Math.PI * 200 + 750, 6);
  });

  it('charges a detour at an intermediate stop the route continues past', () => {
    const itinerary = buildItinerary(alpha, [beta, gamma], planets);
    // alpha -> beta -> gamma -> beta -> alpha; beta is continued past twice
    const totalDetour = itinerary.legs.reduce((sum, leg) => sum + leg.detourKm, 0);
    expect(totalDetour).toBeCloseTo(2 * detourFor(beta), 6);
  });

  it('records every body the route is exposed to, stopped at or not', () => {
    const itinerary = buildItinerary(alpha, [gamma], planets);
    expect(new Set(itinerary.exposedPlanetIds)).toEqual(new Set(['alpha', 'beta', 'gamma']));
  });

  /**
   * The ground path is identical either way, so the total cannot move: a stop
   * takes two more radii off the spans and adds an arc larger by exactly that
   * much. Getting either case wrong shows up here and nowhere else.
   */
  it('costs the same whether a body in the path is a stop or is flown past', () => {
    const direct = buildItinerary(alpha, [gamma], planets);
    const viaBeta = buildItinerary(alpha, [beta, gamma], planets);
    const surfaceOf = (legs: { surfaceDistanceKm: number }[]) =>
      legs.reduce((sum, leg) => sum + leg.surfaceDistanceKm, 0);

    expect(surfaceOf(viaBeta.legs)).toBeLessThan(surfaceOf(direct.legs));
    expect(viaBeta.totalDistanceKm).toBeCloseTo(direct.totalDistanceKm, 6);
  });

  it('produces an empty itinerary when there is nowhere to go', () => {
    const itinerary = buildItinerary(alpha, [], planets);
    expect(itinerary.legs).toHaveLength(0);
    expect(itinerary.totalDistanceKm).toBe(0);
  });
});
