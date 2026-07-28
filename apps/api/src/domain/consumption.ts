import { BASE_CONSUMPTION_RATE, HOURS_PER_YEAR, PASSENGER_CONSUMPTION_RATE } from './constants';
import type { Spacecraft } from './types';

/**
 * Range consumed per km travelled: R = Rb + (Rp * np). Prerequisite 4b.
 * Strictly increasing in passenger count, which makes feasibility monotonic —
 * anything flyable at full capacity is flyable at any lower count.
 */
export function consumptionRate(passengerCount: number): number {
  return BASE_CONSUMPTION_RATE + PASSENGER_CONSUMPTION_RATE * passengerCount;
}

export function rangeConsumed(distanceKm: number, passengerCount: number): number {
  return distanceKm * consumptionRate(passengerCount);
}

/**
 * The distance a craft can actually cover with a given party aboard.
 * Falls as passengers are added, so a lightly loaded craft is a long-range craft.
 */
export function effectiveReachKm(craft: Spacecraft, passengerCount: number): number {
  return craft.rangeKm / consumptionRate(passengerCount);
}

/** Travel time in hours. Stop time is not modelled — see ASSUMPTIONS.md. */
export function durationHours(distanceKm: number, speedKmPerHour: number): number {
  return distanceKm / speedKmPerHour;
}

export function hoursToYears(hours: number): number {
  return hours / HOURS_PER_YEAR;
}

export function durationYears(distanceKm: number, speedKmPerHour: number): number {
  return hoursToYears(durationHours(distanceKm, speedKmPerHour));
}

export function addYears(start: Date, years: number): Date {
  const end = new Date(start.getTime());
  end.setUTCMilliseconds(end.getUTCMilliseconds() + years * HOURS_PER_YEAR * 3_600_000);
  return end;
}
