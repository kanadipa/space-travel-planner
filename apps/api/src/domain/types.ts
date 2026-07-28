/**
 * Domain types.
 *
 * These mirror the supplied YAML, with names normalised to camelCase at the
 * parsing boundary. Nothing in this folder imports Nest, Prisma, or anything
 * that touches the network or a disk — it receives plain objects and returns
 * plain objects, which is what makes it testable on its own.
 */

export type BodyType = 'Planet' | 'Star';

export interface Planet {
  /** Stable identifier, derived from the name at parse time. */
  id: string;
  name: string;
  /**
   * The supplied data includes the sun as a `Star`. No craft in the fleet has an
   * operational range anywhere near its temperature, so it is excluded by the
   * ordinary temperature rule without special-casing.
   */
  type: BodyType;
  /** Distance from the sun, centre to centre (prerequisite 3c). */
  distanceFromSunKm: number;
  diameterKm: number;
  averageTemperatureC: number;
  potentiallyHabitable: boolean;
  /** Descriptive only — surfaced in the UI, not used in any rule. */
  weatherPatterns?: string;
  /** Not referenced by any stated rule. See ASSUMPTIONS.md. */
  radiationLevelsMsv?: number;
  /** Prerequisite 6a declares gravity negligible; descriptive only. */
  gravityMPerS2?: number;
  /** Prerequisite 6c declares moons irrelevant to trajectory; descriptive only. */
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

/** A single point-to-point movement between two planet surfaces. */
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
