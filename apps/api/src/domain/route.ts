import { detourFor, planetsBetween, surfaceDistanceBetween } from './geometry';
import type { Itinerary, Leg, Planet } from './types';

type Direction = 'outward' | 'inward';

function directionBetween(from: Planet, to: Planet): Direction {
  return to.distanceFromSunKm > from.distanceFromSunKm ? 'outward' : 'inward';
}

/**
 * Orders the stops of a round trip that begins and ends at the departure planet.
 *
 * Every body sits on one axis, so a round trip covering a set of destinations
 * always travels twice the span on each side of the departure point, whatever
 * order the stops are visited in. Total distance is therefore invariant to
 * ordering, and the outward-then-inward sweep below is chosen because it reads
 * naturally on a timeline rather than because it is uniquely optimal.
 */
export function orderStops(departure: Planet, destinations: readonly Planet[]): Planet[] {
  const unique = new Map<string, Planet>();
  for (const d of destinations) {
    if (d.id !== departure.id) unique.set(d.id, d);
  }

  const outward = [...unique.values()]
    .filter((p) => p.distanceFromSunKm > departure.distanceFromSunKm)
    .sort((a, b) => a.distanceFromSunKm - b.distanceFromSunKm);

  const inward = [...unique.values()]
    .filter((p) => p.distanceFromSunKm < departure.distanceFromSunKm)
    .sort((a, b) => b.distanceFromSunKm - a.distanceFromSunKm);

  const stops: Planet[] = [departure];

  if (outward.length > 0) {
    stops.push(...outward);
    stops.push(...[...outward].reverse().slice(1));
    stops.push(departure);
  }

  if (inward.length > 0) {
    stops.push(...inward);
    stops.push(...[...inward].reverse().slice(1));
    stops.push(departure);
  }

  return stops;
}

/**
 * Builds the full round trip from an ordered stop list.
 *
 * Two sources of detour are accounted for:
 *
 *  - bodies lying between a leg's endpoints, which are flown around in transit;
 *  - intermediate stops that the route continues past in the same direction.
 *    Departure is from the exact point of arrival (prerequisite 5c), so a craft
 *    that lands and then carries on outward still has the body in its path.
 *    A turnaround stop is exempt: the craft leaves the way it came.
 */
export function buildItinerary(
  departure: Planet,
  destinations: readonly Planet[],
  all: readonly Planet[],
): Itinerary {
  const stops = orderStops(departure, destinations);
  const legs: Leg[] = [];
  const exposed = new Set<string>([departure.id]);

  for (let i = 0; i < stops.length - 1; i += 1) {
    const from = stops[i]!;
    const to = stops[i + 1]!;

    const between = planetsBetween(from, to, all);
    const passedIds = between.map((p) => p.id);
    let detourKm = between.reduce((sum, p) => sum + detourFor(p), 0);

    const previous = i > 0 ? stops[i - 1] : undefined;
    const continuesThrough =
      previous !== undefined && directionBetween(previous, from) === directionBetween(from, to);

    if (continuesThrough) {
      detourKm += detourFor(from);
    }

    const surfaceDistanceKm = surfaceDistanceBetween(from, to);

    legs.push({
      fromPlanetId: from.id,
      toPlanetId: to.id,
      surfaceDistanceKm,
      passedPlanetIds: passedIds,
      detourKm,
      distanceKm: surfaceDistanceKm + detourKm,
    });

    exposed.add(to.id);
    for (const id of passedIds) exposed.add(id);
  }

  return {
    legs,
    exposedPlanetIds: [...exposed],
    totalDistanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
  };
}
