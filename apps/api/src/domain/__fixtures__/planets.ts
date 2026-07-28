import type { Planet, Spacecraft } from '../types';

/**
 * Synthetic bodies with round numbers, so expected values can be computed by
 * hand in the tests rather than copied from the implementation.
 */
export const alpha: Planet = {
  id: 'alpha',
  name: 'Alpha',
  type: 'Planet',
  distanceFromSunKm: 1_000,
  diameterKm: 200,
  averageTemperatureC: 20,
  potentiallyHabitable: true,
};

export const beta: Planet = {
  id: 'beta',
  name: 'Beta',
  type: 'Planet',
  distanceFromSunKm: 2_000,
  diameterKm: 400,
  averageTemperatureC: -50,
  potentiallyHabitable: false,
};

export const gamma: Planet = {
  id: 'gamma',
  name: 'Gamma',
  type: 'Planet',
  distanceFromSunKm: 3_000,
  diameterKm: 100,
  averageTemperatureC: -200,
  potentiallyHabitable: false,
};

/** Nearer the sun than alpha, for testing inward travel. */
export const inner: Planet = {
  id: 'inner',
  name: 'Inner',
  type: 'Planet',
  distanceFromSunKm: 400,
  diameterKm: 100,
  averageTemperatureC: 400,
  potentiallyHabitable: false,
};

export const planets: Planet[] = [inner, alpha, beta, gamma];

export const workhorse: Spacecraft = {
  id: 'workhorse',
  name: 'Workhorse',
  size: 'Large',
  massKg: 50_000,
  capacity: 10,
  rangeKm: 100_000,
  travelSpeedKmPerHour: 10_000,
  gravityGenerator: true,
  operationalTemperatureCMin: -250,
  operationalTemperatureCMax: 450,
};

export const fragile: Spacecraft = {
  ...workhorse,
  id: 'fragile',
  name: 'Fragile',
  capacity: 2,
  rangeKm: 1_000,
  operationalTemperatureCMin: -30,
  operationalTemperatureCMax: 60,
};
