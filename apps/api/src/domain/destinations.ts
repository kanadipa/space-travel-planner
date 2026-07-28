import type { Planet, Spacecraft } from './types';

export function canSurvive(craft: Spacecraft, body: Planet): boolean {
  return (
    body.averageTemperatureC >= craft.operationalTemperatureCMin &&
    body.averageTemperatureC <= craft.operationalTemperatureCMax
  );
}

/**
 * Bodies that could plausibly be visited by something in the fleet.
 *
 * The supplied data includes the sun, which no craft can survive. Rather than
 * special-casing it by type, a body is excluded when no craft in the fleet has an
 * operational temperature range covering it — the sun falls out of that rule, and
 * so would any other body added later with the same problem.
 *
 * This filters what an agent may choose. It does not weaken the per-craft
 * temperature check in `evaluate`, which still binds at every body on the route.
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

/** Bodies excluded from selection, with the reason, so the UI can explain itself. */
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
