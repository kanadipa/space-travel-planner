# Assumptions

The specification intentionally leaves some details open. This document records the assumptions made during implementation.

## Directly from the specification

- Planets are solid spheres; spacecraft cannot fly through them.
- Distances are measured from the centre of the Sun to the centre of each body.
- Spacecraft travel at a constant speed.
- Range is consumed as:

  ```
  R = 1 + 0.042 × passengerCount
  ```

  per kilometre travelled. Reach therefore _falls_ as passengers are added, which
  makes feasibility monotonic: a route flyable at full capacity is flyable at any
  lower count.

- Missions always start from Earth.
- Departure is from the point on Earth's surface closest to the destination.
- Arriving anywhere on a planet's surface counts as visiting it.
- A spacecraft departs from the same point where it landed.
- Gravity and other external forces are ignored.
- If another planet lies in the direct path, the spacecraft must fly around it.
- Moons do not affect trajectories.
- The trajectory should be the most efficient possible.
- Planetary motion is frozen for 42 years, with all bodies treated as collinear.

---

## Interpretation decisions

### Geometry

- The solar system is treated as **one-dimensional**.
- Positions are determined only by `distance_from_sun_km`.
- Distance between two bodies is:

  ```
  |D1 - D2|
  ```

### Travel distance

- Travel is calculated **surface-to-surface**, not centre-to-centre.
- Total travel distance is:

  ```
  |D1 - D2| - R1 - R2
  ```

  where `R1` and `R2` are the radii of the departure and destination planets.

### Flying around planets

- If a planet blocks the direct path, the way around it is **half the planet's circumference (`πr`)** — the shortest valid path around a spherical obstacle.
- What that _costs_ depends on why the body is in the way, and the two cases are not the same:
  - **Passed mid-leg.** The leg is measured straight through the body and is already
    billed for the `2r` chord, so only the excess is added: `πr - 2r`, about `1.14r`.
  - **A stop the route continues past.** The craft takes off from where it landed with
    the whole body still ahead, so it pays the full `πr`.
- If the spacecraft lands and later returns the way it came, no detour is required.

### Temperature

- Every body encountered during the mission must be within the spacecraft's operating temperature range.
- This includes planets passed in transit, not only destinations.

### Route optimisation

- "Most efficient" is interpreted as the **shortest valid trajectory**.
- Fleet utilisation (for example filling spacecraft to capacity) is outside the scope of the specification.

### Destination ordering

- Since all bodies lie on a single axis, changing the order of destinations does not change the total travel distance.
- Destinations are visited from the furthest outward point before returning inward simply for readability.

### The Sun

- The Sun is excluded as a destination.
- No spacecraft can survive its temperature, so presenting it as an option provides no value.
- This is determined from spacecraft capabilities rather than by checking the body's type.

### Mission origin

- Every mission begins on Earth, which is what the specification fixes.
- Mars was considered as a second origin and turn-around point: it is the one other
  habitable body in the data, so a craft could plausibly restock there.
- It is not supported because the brief never asks for it, and offering it would mean
  tracking where each craft currently sits rather than assuming every craft starts at
  Earth. That is a scheduling model, not a trajectory one.

### Mission planning

- One mission uses one spacecraft.
- Passenger groups are not split across multiple spacecraft.

### Saved missions

- Calculated mission values are stored when the mission is created.
- They are not recalculated if spacecraft or planetary data changes later.

---

## Additional assumptions

These behaviours are not defined in the specification but were required for implementation.

- Missions must finish within the 42-year period while planetary positions remain fixed.
- The application's default "today" is assumed to be in 2041 so the full mission window is available.
- Stop durations are ignored because they have no practical effect on mission feasibility.
- A spacecraft cannot be booked for overlapping missions.
- Availability is checked whenever a mission is evaluated or saved.

---

## Booking conflicts

### Why a conflict is 409 and not 422

- **422 is physics.** The mission cannot be flown by that craft on that route, and
  the payload is the thing that has to change.
- **409 is the calendar.** The mission is perfectly flyable; the craft is simply
  taken. Another craft or another date fixes it, with the same payload.
- That difference is also what decides where each check lives. Feasibility is
  deterministic, so it sits in the domain layer. Availability depends on what is
  currently stored, so it sits in `MissionsService` and reads the database.
- If both apply, 422 wins: the payload is the thing to fix first.

### Availability is recomputed, not stored

- It is derived from the saved missions on every evaluation and every save, rather
  than kept as a flag on the craft.
- A stored flag would have to be maintained on save, on amend and on delete, and
  any missed path leaves a craft wrongly blocked or wrongly free.
- The mission being amended is left out of its own check, so a plan never clashes
  with itself.

### Concurrency control on save

The rule above is a read followed by a write, so it needs to say what happens when
two saves overlap.

- **The failure it prevents.** Two saves for the same craft and window both read a
  calendar with no clash on it. Both inserts are legal on their own, so both
  commit and the craft is booked twice. This is write skew, not a lost update: no
  row is overwritten, and the rows that would have conflicted did not exist when
  either transaction looked.
- **Why no weaker isolation level helps.** READ COMMITTED and REPEATABLE READ both
  allow it, because neither transaction writes what the other read.

Three options were considered.

| Option                                                        | Why not / why                                                                                                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Application check only, no transaction                        | What was in place first. Correct sequentially, silently wrong under concurrent saves.                                                                                                                                    |
| `btree_gist` exclusion constraint on `(spacecraftId, window)` | Strongest guarantee, and the database enforces it. Rejected because it needs a Postgres extension in the migration and moves half the rule into the schema, where the 409 message and its conflict list cannot be built. |
| **`SERIALIZABLE` transaction with retry**                     | **Chosen.** The check and the write it authorises become inseparable, the rule stays in one place, and no extension is required.                                                                                         |

- Postgres aborts one transaction of a conflicting pair; `MissionsService.book`
  retries it, and the retry sees the committed booking and answers 409 — the same
  result as if the requests had arrived one after the other.
- The cost is a retry loop and serialisation failures under load. At this scale
  that is not a real cost; at a much larger one, the exclusion constraint becomes
  the better trade.
- A reference collision on the unique index is retried by the same loop, so it
  never surfaces as a 500.

### How the guarantee is verified

- `missions.integration.test.ts` fires a burst of simultaneous saves and asserts
  that exactly one is created.
- Two details in that test are load-bearing, and it proves nothing without them.
  **Eight requests, not two:** a pair does not overlap, because the first
  transaction commits before the second reads. **A warmed connection pool:** a cold
  pool opens connections one at a time and quietly serialises the burst.
- Both were found by disabling the fix and watching the test still pass. With both
  in place, READ COMMITTED books the craft all eight times.

---

## Known simplifications

- Spacecraft are not held during planning. Two agents are both offered a free craft;
  the second save is refused rather than queued. A reservation with a timeout is a
  product decision the brief does not authorise.
- The trajectory model is one-dimensional rather than physically accurate.
- Spacecraft properties are snapshotted when a mission is saved.
- With the supplied data, every feasible mission completes well within the 42-year limit, although the constraint is still enforced.
