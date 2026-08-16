export interface Planet {
  id: string;
  name: string;
  type: 'Planet' | 'Star';
  distanceFromSunKm: number;
  diameterKm: number;
  averageTemperatureC: number;
  potentiallyHabitable: boolean;
  weatherPatterns?: string;
  moons?: string[];
}

export interface Spacecraft {
  id: string;
  name: string;
  size: string;
  capacity: number;
  rangeKm: number;
  travelSpeedKmPerHour: number;
  gravityGenerator: boolean;
  operationalTemperatureCMin: number;
  operationalTemperatureCMax: number;
}

export interface Leg {
  fromPlanetId: string;
  toPlanetId: string;
  surfaceDistanceKm: number;
  passedPlanetIds: string[];
  detourKm: number;
  distanceKm: number;
}

export interface Failure {
  code:
    'CAPACITY_EXCEEDED' | 'OUT_OF_RANGE' | 'TEMPERATURE_OUT_OF_BOUNDS' | 'EXCEEDS_MISSION_WINDOW';
  actionable: boolean;
  message: string;
  detail: Record<string, string | number>;
}

export interface Evaluation {
  spacecraftId: string;
  feasible: boolean;
  failures: Failure[];
  itinerary: { legs: Leg[]; exposedPlanetIds: string[]; totalDistanceKm: number };
  consumptionRate: number;
  rangeConsumedKm: number;
  rangeUtilisation: number;
  durationYears: number;
}

export interface EvaluationResponse {
  anyFeasible: boolean;
  evaluations: Evaluation[];
  busySpacecraftIds?: string[];
}

export interface CatalogResponse {
  departure: Planet;
  destinations: Planet[];
  excluded: { body: Planet; reason: string }[];
}

export interface Mission {
  id: string;
  reference: string;
  name: string;
  spacecraftId: string;
  passengerCount: number;
  destinationIds: string[];
  departureDate: string;
  arrivalDate: string;
  totalDistanceKm: number;
  rangeConsumedKm: number;
  durationYears: number;
  legs: Leg[];
  spacecraftSnapshot: Spacecraft;
  createdAt: string;
}
