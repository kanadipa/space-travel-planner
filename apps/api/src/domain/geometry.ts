import type { Planet } from './types';

export function radiusOf(planet: Planet): number {
  return planet.diameterKm / 2;
}

/**
 * Distances come centre to centre (3c), but craft leave and land on surfaces
 * (5a, 5b). Both ends sit a radius closer, so both radii come off.
 */
export function surfaceDistanceBetween(a: Planet, b: Planet): number {
  const centreGap = Math.abs(a.distanceFromSunKm - b.distanceFromSunKm);
  return Math.max(0, centreGap - radiusOf(a) - radiusOf(b));
}

/** Orbits are frozen, so anything between the endpoints is in the way (6b). */
export function planetsBetween(a: Planet, b: Planet, all: readonly Planet[]): Planet[] {
  const low = Math.min(a.distanceFromSunKm, b.distanceFromSunKm);
  const high = Math.max(a.distanceFromSunKm, b.distanceFromSunKm);

  return all
    .filter((p) => p.id !== a.id && p.id !== b.id)
    .filter((p) => p.distanceFromSunKm > low && p.distanceFromSunKm < high)
    .sort((p, q) => p.distanceFromSunKm - q.distanceFromSunKm);
}

/**
 * Planets are solid, so going around one means hugging the surface: a semi-
 * circle, pi * r. That's the full arc — near side to far side.
 *
 * For a body you fly around, use `clearanceFor` instead.
 */
export function detourFor(planet: Planet): number {
  return Math.PI * radiusOf(planet);
}

/**
 * What a body *between* the endpoints actually costs.
 *
 * The leg distance already runs straight through it, paying 2r. Going around
 * costs the arc minus that chord — ~1.14r, not 3.14r. Charging the full arc
 * would bill the crossing twice.
 */
export function clearanceFor(planet: Planet): number {
  return detourFor(planet) - 2 * radiusOf(planet);
}
