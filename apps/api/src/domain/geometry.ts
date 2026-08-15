import type { Planet } from './types';

export function radiusOf(planet: Planet): number {
  return planet.diameterKm / 2;
}

/**
 * Supplied distances are centre to centre, but a craft departs from the
 * surface point nearest its destination and arrives on the far surface.
 * Both points sit one radius nearer the other body, so both radii come off.
 */
export function surfaceDistanceBetween(a: Planet, b: Planet): number {
  const centreGap = Math.abs(a.distanceFromSunKm - b.distanceFromSunKm);
  return Math.max(0, centreGap - radiusOf(a) - radiusOf(b));
}

export function planetsBetween(a: Planet, b: Planet, all: readonly Planet[]): Planet[] {
  const low = Math.min(a.distanceFromSunKm, b.distanceFromSunKm);
  const high = Math.max(a.distanceFromSunKm, b.distanceFromSunKm);

  return all
    .filter((p) => p.id !== a.id && p.id !== b.id)
    .filter((p) => p.distanceFromSunKm > low && p.distanceFromSunKm < high)
    .sort((p, q) => p.distanceFromSunKm - q.distanceFromSunKm);
}

/**
 * Planets are solid, so the shortest path clearing one is a semicircle over
 * its surface: pi * r, replacing the 2r a straight line would have covered.
 */
export function detourFor(planet: Planet): number {
  return Math.PI * radiusOf(planet);
}
