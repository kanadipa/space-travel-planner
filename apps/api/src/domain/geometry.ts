import type { Planet } from './types';

export function radiusOf(planet: Planet): number {
  return planet.diameterKm / 2;
}

/**
 * Distance travelled between two planet surfaces along the axis.
 *
 * Supplied distances are centre to centre (prerequisite 3c), but a planet counts
 * as visited on contact with its surface (5b), and departure is from the surface
 * point nearest the destination (5a). Both of those points sit one radius nearer
 * the other body than the centre does, so both radii come off the gap.
 *
 * The subtraction is direction independent: whichever body is further from the
 * sun, the near-facing surface points are always the closest pair. Returns 0
 * rather than a negative number for the degenerate same-planet case.
 */
export function surfaceDistanceBetween(a: Planet, b: Planet): number {
  const centreGap = Math.abs(a.distanceFromSunKm - b.distanceFromSunKm);
  return Math.max(0, centreGap - radiusOf(a) - radiusOf(b));
}

/**
 * Planets lying strictly between two endpoints on the axis.
 *
 * With orbits halted and every body collinear, anything whose centre falls
 * between the two endpoints is directly in the path (prerequisite 6b).
 */
export function planetsBetween(a: Planet, b: Planet, all: readonly Planet[]): Planet[] {
  const low = Math.min(a.distanceFromSunKm, b.distanceFromSunKm);
  const high = Math.max(a.distanceFromSunKm, b.distanceFromSunKm);

  return all
    .filter((p) => p.id !== a.id && p.id !== b.id)
    .filter((p) => p.distanceFromSunKm > low && p.distanceFromSunKm < high)
    .sort((p, q) => p.distanceFromSunKm - q.distanceFromSunKm);
}

/**
 * Arc length added by flying around a body rather than through it.
 *
 * Planets are solid (prerequisite 3a), so the axis cannot be followed through
 * one. The shortest path that clears a sphere while optimising the trajectory
 * (6d) is a semicircle over its surface: pi * r, replacing the 2r that a
 * straight line through the body would have covered.
 */
export function detourFor(planet: Planet): number {
  return Math.PI * radiusOf(planet);
}
