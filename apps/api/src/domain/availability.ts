/**
 * Whether a spacecraft is already committed to another mission.
 *
 * Availability is derived, never stored. A craft is busy because saved missions
 * say so, so there is no `isAvailable` column to fall out of step when a mission
 * is edited or deleted. The trade-off is a read over the saved missions on every
 * evaluation and every save, which at this data size costs nothing.
 */

/** A period a craft is committed for: outbound, at the destinations, and back. */
export interface Window {
  departure: Date;
  arrival: Date;
}

export interface Booking extends Window {
  missionId: string;
  spacecraftId: string;
}

/**
 * Half-open comparison, so a craft that lands at the exact moment another
 * mission departs is not counted as a clash. Turnaround time is not modelled —
 * see ASSUMPTIONS.md — so the boundary has to fall one way, and treating it as
 * free keeps the rule from inventing a constraint the brief does not state.
 */
export function overlaps(a: Window, b: Window): boolean {
  return a.departure < b.arrival && b.departure < a.arrival;
}

/**
 * Saved missions that would clash with a proposed window for the same craft.
 *
 * `ignoreMissionId` is the mission being edited: amending a saved plan must not
 * report it as conflicting with itself, which is the case that makes a stored
 * availability flag so awkward to maintain.
 *
 * Generic in the booking so a caller that carries more than the window — the save
 * path wants the mission reference for its error — gets those fields back rather
 * than a widened type it has to cast away.
 */
export function conflictsFor<T extends Booking>(
  spacecraftId: string,
  proposed: Window,
  bookings: readonly T[],
  ignoreMissionId?: string,
): T[] {
  return bookings
    .filter((booking) => booking.spacecraftId === spacecraftId)
    .filter((booking) => booking.missionId !== ignoreMissionId)
    .filter((booking) => overlaps(proposed, booking))
    .sort((a, b) => a.departure.getTime() - b.departure.getTime());
}
