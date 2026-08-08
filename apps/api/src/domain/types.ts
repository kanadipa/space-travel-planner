export type BodyType = 'Planet' | 'Star';

export interface Planet {
  /** Stable identifier, derived from the name at parse time. */
  id: string;
  name: string;
  type: BodyType;
  /** Distance from the sun, centre to centre (prerequisite 3c). */
  distanceFromSunKm: number;
  diameterKm: number;
  averageTemperatureC: number;
  potentiallyHabitable: boolean;

  // Carried through from the YAML but used by no rule: 6a declares gravity
  // negligible and 6c declares moons irrelevant. See ASSUMPTIONS.md.
  weatherPatterns?: string;
  radiationLevelsMsv?: number;
  gravityMPerS2?: number;
  moons?: string[];
}

export interface Spacecraft {
  id: string;
  name: string;
  size: string;
  massKg: number;
  capacity: number;
  /** Nominal range in km, before passenger consumption is applied. */
  rangeKm: number;
  travelSpeedKmPerHour: number;
  gravityGenerator: boolean;
  operationalTemperatureCMin: number;
  operationalTemperatureCMax: number;
}

export interface Leg {
  fromPlanetId: string;
  toPlanetId: string;
  /** Straight-line surface-to-surface distance along the axis. */
  surfaceDistanceKm: number;
  /** Planets that lie between the endpoints and must be flown around. */
  passedPlanetIds: string[];
  /** Total arc length added by flying around bodies on this leg. */
  detourKm: number;
  /** surfaceDistanceKm + detourKm */
  distanceKm: number;
}

/** An ordered sequence of legs, starting and ending at the departure planet. */
export interface Itinerary {
  legs: Leg[];
  /** Every planet touched by the route, whether stopped at or passed. */
  exposedPlanetIds: string[];
  totalDistanceKm: number;
}

export type FailureCode =
  | 'CAPACITY_EXCEEDED'
  | 'OUT_OF_RANGE'
  | 'TEMPERATURE_OUT_OF_BOUNDS'
  | 'EXCEEDS_MISSION_WINDOW';

export interface Failure {
  code: FailureCode;
  /** True when the agent can resolve it by changing an input. */
  actionable: boolean;
  message: string;
  /** Structured detail so the UI can render its own copy if it prefers. */
  detail: Record<string, number | string>;
}

export interface Evaluation {
  spacecraftId: string;
  feasible: boolean;
  failures: Failure[];
  itinerary: Itinerary;
  consumptionRate: number;
  rangeConsumedKm: number;
  /** Fraction of the craft's nominal range used, 0..n. */
  rangeUtilisation: number;
  durationYears: number;
}
