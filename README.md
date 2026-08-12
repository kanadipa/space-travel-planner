# Space mission planner

A prototype planning tool for space travel agents. An agent enters a party size and
a set of destinations; the application works out the trajectory, tells them which
spacecraft can fly it and why the others cannot, and saves the result as a mission
plan that can be reloaded later.

## Running it

You need **Node 20 or later** and **Docker Desktop running**. Postgres runs in a
container — you do not need to type any `docker` commands yourself.

```bash
git clone <repo> && cd space-mission-planner
npm install
npm run dev
```

Then open **http://localhost:5173**.

`npm run dev` does the whole setup before it starts anything: creates
`apps/api/.env`, starts the Postgres container, waits until it is accepting
connections, applies the migrations, and then runs the API and the web client
together in one terminal. It is safe to re-run — every step checks before it
acts — so it is also what you run after pulling a schema change.

| Command | What it does |
|---|---|
| `npm run dev` | Setup, then both servers — API on 3000, web on 5173 |
| `npm run setup` | The setup only, without starting the servers |
| `npm test` | 119 unit, integration and component tests. Needs the database up |
| `npm run test:e2e` | 4 browser tests through the full stack |
| `npm run db:down` | Stops the Postgres container |

If you cannot run Docker, switch the `datasource` in
`apps/api/prisma/schema.prisma` to `sqlite` with `DATABASE_URL="file:./dev.db"`.
The `String[]` and `Json` columns would have to become serialised strings first,
so that path is untested — Docker is the supported one.

## Repository layout

```
apps/api             NestJS + Prisma
  src/domain/        planning logic — no Nest, no Prisma, no HTTP
  src/catalog/       loads the supplied YAML, normalises it
  src/planning/      the only caller of the domain layer
  src/missions/      persistence, DTOs, validation
apps/web             React + Vite client
data/                supplied planet and spacecraft data
e2e/                 Playwright: real browser, built API, real Postgres
scripts/setup.mjs    one-command first launch
```

`src/domain` imports nothing from the framework. It takes plain objects and
returns plain objects, so the planning rules can be tested without bootstrapping
Nest or a database. It is a folder rather than a package deliberately: the value
is in dependencies pointing one way, and a folder enforces that just as well as a
workspace would, without the build-ordering cost.

## The planning model

Every body sits on a single axis, and the supplied `distance_from_sun_km` values
place them on it. Planning therefore reduces to arithmetic on one dimension.

**Distance between two bodies.** Supplied distances are centre to centre, but a
craft departs from the surface point nearest its destination and arrives on the
far body's surface. Both radii come off the gap:

```
surfaceDistance(a, b) = |dₐ − d_b| − rₐ − r_b
```

**Detours.** Planets are solid, so a body lying between two endpoints cannot be
flown through. The shortest path that clears a sphere runs over its surface, a
semicircle of length `πr`, replacing the `2r` a straight line would have covered.

A craft that stops at a body and then continues in the same direction also pays
the detour: it departs from its exact arrival point, so the body is still in the
way. A craft that turns around does not — it leaves the way it came.

**Range.** Consumption is `R = 1 + 0.042 × n_p` per km, so the distance a craft
can actually cover is `range / R`. Reach *falls* as passengers are added, which
means a lightly loaded craft is a long-range craft. Because `R` rises
monotonically with passenger count, feasibility is monotonic too: anything
flyable at full capacity is flyable at any lower count.

**Feasibility.** Four independent checks — capacity, range, mission window, and
operational temperature at every body on the route. None depends on another's
result, so all four run and every failure is reported. Failures are ordered by how
easily an agent can act on them; temperature is intrinsic to the craft and route
and is marked non-actionable.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/planets` | Selectable destinations, plus excluded bodies and why |
| `GET` | `/api/spacecraft` | The fleet |
| `POST` | `/api/evaluations` | Evaluate the whole fleet against a proposed route |
| `GET` | `/api/missions` | List saved plans |
| `GET` | `/api/missions/:id` | Load one |
| `GET` | `/api/missions/reference/:ref` | Load by booking code |
| `POST` | `/api/missions` | Save |
| `PATCH` | `/api/missions/:id` | Amend and revalidate |
| `DELETE` | `/api/missions/:id` | Remove |

Four outcomes are kept distinct. A malformed body is **400**, rejected by the
global `ValidationPipe` against the DTO. A well-formed request describing a
mission that cannot be flown is **422** on save. A flyable mission on a craft that
is already committed elsewhere is **409**, naming the mission in the way. And an
evaluation that finds no feasible craft is **200** with `anyFeasible: false` — a
valid answer to a valid question, so the client never has to treat it as an error.

The client sends only inputs: craft, passenger count, destinations, departure
date. The server recomputes everything else through the same domain functions the
evaluator uses, so a stale or malformed client cannot persist an impossible
mission.

## The interface

A single planning screen rather than a wizard. Passenger count and destinations
sit at the top; the trajectory, the totals and the fleet update beneath them as
those inputs change. Because range consumption depends on passenger count, the
consequence of a choice is visible at the moment it is made — moving the slider
visibly changes which craft can fly the route.

Craft that cannot fly a route stay in the list, greyed out, each carrying a short
reason — amber when the agent can act on it, red when it is intrinsic to the craft
and route. The server's full sentence is one hover or one tab-stop away, so the
list stays scannable without hiding why. Dropping excluded craft entirely would be
less work and considerably less useful.

Which saved plan is open is shown next to the title, with the booking reference and
a flag when the inputs have been changed but not yet saved.

The trajectory diagram draws the axis, the route, and a dashed arc for each body
flown around. Bodies are spaced evenly in orbital order rather than to scale: the
supplied distances span 58 million to 4.5 billion km, so any true scale puts the
four inner planets on top of each other. The caption says so, and the detour key
only appears when the route actually has one.

Evaluation is a debounced call to the API rather than a local computation. One
execution path means the client's numbers and the server's numbers are provably
the same, and at this data size the round trip is imperceptible.

## Decisions and trade-offs

[ASSUMPTIONS.md](./ASSUMPTIONS.md) records what the brief stated, what was
interpreted and why, what was invented, and which fidelity limits were accepted
deliberately.

## Testing

119 tests in three layers, plus a small end-to-end pass. `npm test` runs the first
three and needs the database up; `npm run test:e2e` drives a browser.

**Domain (56).** Pure arithmetic with several easy-to-get-wrong edge cases, so
this is where the tests are concentrated: distance symmetry and identity, the
radius subtraction, detour counting, the turnaround exemption, consumption
monotonicity, and failure collection. No mocks, no fixtures beyond four synthetic
bodies with round numbers.

**API (43).** The real Nest application over supertest, against the real Postgres,
using the same request pipeline `main.ts` installs — both call the shared
`configureApp`, so a test cannot pass against a pipeline users do not hit. Covers
the three distinct outcomes, with the 422 path taken furthest: each failure mode
separately, several at once, the actionable flag, and a check that a refused
mission is not persisted.

Running against the real database rather than a stand-in is what makes these tests
worth trusting: the `String[]` and `Json` columns and the unique-reference
constraint are exercised as they actually behave. The cost is that `npm test`
needs Docker, and the mission table is emptied when the suite boots.

**Client (20).** The planner screen against a stubbed `fetch` returning the API's
real shapes. Covers the product decisions rather than the markup: ruled-out craft
stay visible with their reasons, a ruled-out craft cannot be chosen, saving is
blocked until a feasible craft is picked, a 422 surfaces the server's reasons, the
open plan is named in the header, and — the contract the server depends on — a
save sends inputs only, never a distance or a duration.

### End to end (3)

```bash
npm run test:e2e
```

Playwright drives a real Chromium against the built API and the same Postgres,
covering the journey the unit layers cannot: save a plan, reload the page and find
it still there, then load it back into the planner. It reuses a dev server if one
is already running.

## Craft availability

A craft already committed to another saved mission over the same window cannot be
booked. The fleet list marks it "already booked", the save button goes dead with the
reason beside it, and `POST /missions` answers **409** if asked anyway — the browser
is where the rule is explained, not where it is enforced.

It is a window overlap, not a date match. A craft that left for Jupiter on 29 July
is still in flight in September, so comparing departure dates alone would offer a
craft that is three months into another mission.

Two refusals, kept apart on purpose. **422** is physics: this craft can never fly
this route, and the payload is what has to change. **409** is the calendar: the
mission is flyable and the craft is simply taken, so another craft or another date
fixes it. Feasibility therefore lives in the domain layer, which answers the same
way every time, and availability is checked in `MissionsService`, which answers from
the database. When both apply the 422 wins.

It is a derived read, not stored state. `conflictsFor` compares the proposed window
against the saved missions on every evaluation and every save, so there is no
availability flag to fall out of step when a mission is edited or deleted — the case
that makes a stored flag awkward. The mission being amended is excluded from its own
check, and because duration is distance over each craft's own speed, every craft is
tested against a different window for the same route.

## Not built

- Cross-browser and mobile viewports — Playwright runs Chromium only
- Passenger pooling across bookings — see ASSUMPTIONS.md
- Turnaround time between missions — a craft landing as another departs counts as free
