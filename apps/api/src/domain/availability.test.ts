import { conflictsFor, overlaps, type Booking } from './availability';

const at = (year: number) => new Date(Date.UTC(year, 0, 1));

const booking = (missionId: string, spacecraftId: string, from: number, to: number): Booking => ({
  missionId,
  spacecraftId,
  departure: at(from),
  arrival: at(to),
});

describe('overlaps', () => {
  it('is true when one window starts inside another', () => {
    expect(
      overlaps(
        { departure: at(2041), arrival: at(2045) },
        { departure: at(2043), arrival: at(2047) },
      ),
    ).toBe(true);
  });

  it('is true when one window entirely contains another', () => {
    expect(
      overlaps(
        { departure: at(2041), arrival: at(2050) },
        { departure: at(2043), arrival: at(2045) },
      ),
    ).toBe(true);
  });

  it('is false for windows that do not meet', () => {
    expect(
      overlaps(
        { departure: at(2041), arrival: at(2043) },
        { departure: at(2045), arrival: at(2047) },
      ),
    ).toBe(false);
  });

  /** Landing and leaving at the same instant is allowed: no turnaround is modelled. */
  it('is false when one window ends exactly as the other begins', () => {
    expect(
      overlaps(
        { departure: at(2041), arrival: at(2045) },
        { departure: at(2045), arrival: at(2050) },
      ),
    ).toBe(false);
  });

  it('is symmetric', () => {
    const a = { departure: at(2041), arrival: at(2046) };
    const b = { departure: at(2044), arrival: at(2049) };
    expect(overlaps(a, b)).toBe(overlaps(b, a));
  });
});

describe('conflictsFor', () => {
  const bookings = [
    booking('m1', 'nyx-odyssey', 2041, 2044),
    booking('m2', 'nyx-odyssey', 2050, 2053),
    booking('m3', 'serenity-xl', 2041, 2044),
  ];

  it('finds a clash on the same craft', () => {
    const found = conflictsFor('nyx-odyssey', { departure: at(2042), arrival: at(2043) }, bookings);
    expect(found.map((b) => b.missionId)).toEqual(['m1']);
  });

  it('ignores bookings for other craft', () => {
    const found = conflictsFor('nyx-odyssey', { departure: at(2041), arrival: at(2044) }, bookings);
    expect(found.every((b) => b.spacecraftId === 'nyx-odyssey')).toBe(true);
  });

  it('is empty when the craft is free for the whole window', () => {
    expect(
      conflictsFor('nyx-odyssey', { departure: at(2045), arrival: at(2049) }, bookings),
    ).toEqual([]);
  });

  /** Amending a saved plan must not report it as clashing with itself. */
  it('excludes the mission being edited', () => {
    const proposed = { departure: at(2041), arrival: at(2044) };
    expect(conflictsFor('nyx-odyssey', proposed, bookings, 'm1')).toEqual([]);
  });

  it('still reports other clashes while editing one mission', () => {
    const proposed = { departure: at(2042), arrival: at(2052) };
    const found = conflictsFor('nyx-odyssey', proposed, bookings, 'm1');
    expect(found.map((b) => b.missionId)).toEqual(['m2']);
  });

  it('returns clashes in departure order', () => {
    const crowded = [
      booking('late', 'nyx-odyssey', 2048, 2052),
      booking('early', 'nyx-odyssey', 2041, 2044),
    ];
    const found = conflictsFor('nyx-odyssey', { departure: at(2042), arrival: at(2050) }, crowded);
    expect(found.map((b) => b.missionId)).toEqual(['early', 'late']);
  });
});
