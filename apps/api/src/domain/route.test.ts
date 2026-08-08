import { alpha, beta, gamma, inner, planets } from './__fixtures__/planets';
import { detourFor } from './geometry';
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
    expect(outbound?.detourKm).toBeCloseTo(detourFor(beta), 6);
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

  it('stopping at an intermediate body shortens the surface distance flown', () => {
    const direct = buildItinerary(alpha, [gamma], planets);
    const viaBeta = buildItinerary(alpha, [beta, gamma], planets);
    const surfaceOf = (legs: { surfaceDistanceKm: number }[]) =>
      legs.reduce((sum, leg) => sum + leg.surfaceDistanceKm, 0);

    // Each stop costs two radii of surface clearance that a fly-past does not.
    expect(surfaceOf(viaBeta.legs)).toBeLessThan(surfaceOf(direct.legs));
  });

  it('produces an empty itinerary when there is nowhere to go', () => {
    const itinerary = buildItinerary(alpha, [], planets);
    expect(itinerary.legs).toHaveLength(0);
    expect(itinerary.totalDistanceKm).toBe(0);
  });
});
