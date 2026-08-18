interface Window {
  departure: Date;
  arrival: Date;
}

export interface Booking extends Window {
  missionId: string;
  spacecraftId: string;
}

export function overlaps(a: Window, b: Window): boolean {
  return a.departure < b.arrival && b.departure < a.arrival;
}

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
