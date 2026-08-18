import type { Planet, Spacecraft } from './types';

export function canSurvive(craft: Spacecraft, body: Planet): boolean {
  return (
    body.averageTemperatureC >= craft.operationalTemperatureCMin &&
    body.averageTemperatureC <= craft.operationalTemperatureCMax
  );
}

/**
 * Excludes the sun by temperature, not by `type: Star`. Only filters the picker —
 * the per-craft check in `evaluate` still binds at every body on the route.
 */
export function selectableDestinations(
  bodies: readonly Planet[],
  fleet: readonly Spacecraft[],
  departure: Planet,
): Planet[] {
  return bodies
    .filter((body) => body.id !== departure.id)
    .filter((body) => fleet.some((craft) => canSurvive(craft, body)))
    .sort((a, b) => a.distanceFromSunKm - b.distanceFromSunKm);
}

/** The excluded bodies with their reason, so the UI can explain itself. */
export function unreachableBodies(
  bodies: readonly Planet[],
  fleet: readonly Spacecraft[],
  departure: Planet,
): { body: Planet; reason: string }[] {
  return bodies
    .filter((body) => body.id !== departure.id)
    .filter((body) => !fleet.some((craft) => canSurvive(craft, body)))
    .map((body) => ({
      body,
      reason: `No craft in the fleet can operate at ${body.averageTemperatureC} °C.`,
    }));
}
