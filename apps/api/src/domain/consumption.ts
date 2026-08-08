import { BASE_CONSUMPTION_RATE, HOURS_PER_YEAR, PASSENGER_CONSUMPTION_RATE } from './constants';
import type { Spacecraft } from './types';

/**
 * R = Rb + (Rp * np), per km travelled (4b). Strictly increasing in passenger
 * count, so feasibility is monotonic: flyable when full is flyable when lighter.
 */
export function consumptionRate(passengerCount: number): number {
  return BASE_CONSUMPTION_RATE + PASSENGER_CONSUMPTION_RATE * passengerCount;
}

export function rangeConsumed(distanceKm: number, passengerCount: number): number {
  return distanceKm * consumptionRate(passengerCount);
}

/** Falls as passengers are added: a lightly loaded craft is a long-range craft. */
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
