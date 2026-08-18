import { clearanceFor, detourFor, planetsBetween, surfaceDistanceBetween } from './geometry';
import type { Itinerary, Leg, Planet } from './types';

type Direction = 'outward' | 'inward';

function directionBetween(from: Planet, to: Planet): Direction {
  return to.distanceFromSunKm > from.distanceFromSunKm ? 'outward' : 'inward';
}

/** Fly the branch out, come back the way you came, finish at the departure. */
function outAndBack(departure: Planet, branch: readonly Planet[]): Planet[] {
  if (branch.length === 0) return [];
  return [...branch, ...branch.slice(0, -1).reverse(), departure];
}

/**
 * On a single axis the round trip covers the same distance whatever order the
 * stops come in. Outward first, then inward, just because it reads better.
 */
export function orderStops(departure: Planet, destinations: readonly Planet[]): Planet[] {
  const unique = [
    ...new Map(destinations.filter((d) => d.id !== departure.id).map((d) => [d.id, d])).values(),
  ];

  const outward = unique
    .filter((p) => p.distanceFromSunKm > departure.distanceFromSunKm)
    .sort((a, b) => a.distanceFromSunKm - b.distanceFromSunKm);

  const inward = unique
    .filter((p) => p.distanceFromSunKm < departure.distanceFromSunKm)
    .sort((a, b) => b.distanceFromSunKm - a.distanceFromSunKm);

  return [departure, ...outAndBack(departure, outward), ...outAndBack(departure, inward)];
}

/**
 * Detours come from two places:
 *
 *  - planets passed mid-leg: the leg already flies through them, so only the
 *    extra over that crossing counts — `clearanceFor`;
 *  - a stop the route carries on past in the same direction: you take off from
 *    where you landed, so the planet is still in front of you and you pay the
 *    full arc — `detourFor`. Turnarounds are free, you leave the way you came.
 */
function detourKmFor(
  from: Planet,
  to: Planet,
  previous: Planet | undefined,
  passed: readonly Planet[],
): number {
  const clearances = passed.reduce((sum, p) => sum + clearanceFor(p), 0);
  const carriesOn =
    previous !== undefined && directionBetween(previous, from) === directionBetween(from, to);
  return clearances + (carriesOn ? detourFor(from) : 0);
}

function buildLeg(
  from: Planet,
  to: Planet,
  previous: Planet | undefined,
  all: readonly Planet[],
): Leg {
  const passed = planetsBetween(from, to, all);
  const surfaceDistanceKm = surfaceDistanceBetween(from, to);
  const detourKm = detourKmFor(from, to, previous, passed);

  return {
    fromPlanetId: from.id,
    toPlanetId: to.id,
    surfaceDistanceKm,
    passedPlanetIds: passed.map((p) => p.id),
    detourKm,
    distanceKm: surfaceDistanceKm + detourKm,
  };
}

export function buildItinerary(
  departure: Planet,
  destinations: readonly Planet[],
  all: readonly Planet[],
): Itinerary {
  const stops = orderStops(departure, destinations);
  const legs = stops
    .slice(0, -1)
    .map((from, i) => buildLeg(from, stops[i + 1]!, stops[i - 1], all));

  return {
    legs,
    exposedPlanetIds: [
      ...new Set([
        departure.id,
        ...legs.flatMap((leg) => [leg.toPlanetId, ...leg.passedPlanetIds]),
      ]),
    ],
    totalDistanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
  };
}
