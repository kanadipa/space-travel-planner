/** Base range consumption per km travelled (prerequisite 4b.i). */
export const BASE_CONSUMPTION_RATE = 1;

/** Additional consumption per km, per boarded passenger (prerequisite 4b.ii). */
export const PASSENGER_CONSUMPTION_RATE = 0.042;

/**
 * The window during which planetary motion is halted, and therefore the only
 * period in which the straight-line model holds. Missions must complete inside it.
 */
export const MISSION_WINDOW_YEARS = 40;

/** Departure planet. Prerequisite 5a fixes the initial departure to Earth. */
export const DEPARTURE_PLANET_NAME = 'Earth';

export const HOURS_PER_YEAR = 365.25 * 24;
