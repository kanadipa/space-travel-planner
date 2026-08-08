import { MISSION_WINDOW_YEARS } from './constants';
import { consumptionRate, durationYears, rangeConsumed } from './consumption';
import { buildItinerary } from './route';
import type { Evaluation, Failure, Itinerary, Planet, Spacecraft } from './types';

/**
 * All four checks run: none depends on another's result, and an agent wants every
 * reason at once. Failures come back ordered by how easily they can be acted on.
 */
export function evaluate(
  craft: Spacecraft,
  departure: Planet,
  destinations: readonly Planet[],
  allPlanets: readonly Planet[],
  passengerCount: number,
): Evaluation {
  const itinerary = buildItinerary(departure, destinations, allPlanets);
  const rate = consumptionRate(passengerCount);
  const consumed = rangeConsumed(itinerary.totalDistanceKm, passengerCount);
  const years = durationYears(itinerary.totalDistanceKm, craft.travelSpeedKmPerHour);

  const failures: Failure[] = [];

  if (passengerCount > craft.capacity) {
    failures.push({
      code: 'CAPACITY_EXCEEDED',
      actionable: true,
      message: `Carries ${craft.capacity}, ${passengerCount} booked. Reduce the party to ${craft.capacity} or choose a larger craft.`,
      detail: { capacity: craft.capacity, passengerCount },
    });
  }

  if (consumed > craft.rangeKm) {
    failures.push({
      code: 'OUT_OF_RANGE',
      actionable: true,
      message: `Short by ${Math.round(consumed - craft.rangeKm).toLocaleString()} km. Remove a destination, or reduce passengers to lower consumption.`,
      detail: {
        rangeKm: craft.rangeKm,
        rangeConsumedKm: consumed,
        shortfallKm: consumed - craft.rangeKm,
      },
    });
  }

  if (years > MISSION_WINDOW_YEARS) {
    failures.push({
      code: 'EXCEEDS_MISSION_WINDOW',
      actionable: true,
      message: `Takes ${years.toFixed(1)} years, beyond the ${MISSION_WINDOW_YEARS}-year window. Shorten the route or choose a faster craft.`,
      detail: { durationYears: years, windowYears: MISSION_WINDOW_YEARS },
    });
  }

  for (const failure of temperatureFailures(craft, itinerary, allPlanets)) {
    failures.push(failure);
  }

  return {
    spacecraftId: craft.id,
    feasible: failures.length === 0,
    failures,
    itinerary,
    consumptionRate: rate,
    rangeConsumedKm: consumed,
    rangeUtilisation: consumed / craft.rangeKm,
    durationYears: years,
  };
}

/** Binds at every body on the route, including ones only flown around. */
function temperatureFailures(
  craft: Spacecraft,
  itinerary: Itinerary,
  allPlanets: readonly Planet[],
): Failure[] {
  const byId = new Map(allPlanets.map((p) => [p.id, p]));

  return itinerary.exposedPlanetIds
    .map((id) => byId.get(id))
    .filter((p): p is Planet => p !== undefined)
    .filter(
      (p) =>
        p.averageTemperatureC < craft.operationalTemperatureCMin ||
        p.averageTemperatureC > craft.operationalTemperatureCMax,
    )
    .map((p) => ({
      code: 'TEMPERATURE_OUT_OF_BOUNDS' as const,
      actionable: false,
      message: `Cannot operate at ${p.name} (${p.averageTemperatureC} °C, rated ${craft.operationalTemperatureCMin} to ${craft.operationalTemperatureCMax} °C).`,
      detail: {
        planetId: p.id,
        planetName: p.name,
        planetTemperatureC: p.averageTemperatureC,
        minC: craft.operationalTemperatureCMin,
        maxC: craft.operationalTemperatureCMax,
      },
    }));
}

/** Evaluates a whole fleet, feasible craft first, then by range headroom. */
export function evaluateFleet(
  fleet: readonly Spacecraft[],
  departure: Planet,
  destinations: readonly Planet[],
  allPlanets: readonly Planet[],
  passengerCount: number,
): Evaluation[] {
  return fleet
    .map((craft) => evaluate(craft, departure, destinations, allPlanets, passengerCount))
    .sort((a, b) => {
      if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
      return a.rangeUtilisation - b.rangeUtilisation;
    });
}
