# Space mission planner

A prototype planning tool for space travel agents. An agent enters a party size and
a set of destinations; the application works out the trajectory, tells them which
spacecraft can fly it and why the others cannot, and saves the result as a mission
plan that can be reloaded later.

![The planner screen: a two-stop route to Mars and Jupiter, with live totals and
the fleet evaluated against it](./docs/planner.jpg)

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
| `npm test` | 95 unit, integration and component tests. No Docker needed |
| `npm run test:e2e` | 11 browser tests against a real Postgres |
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
returns plain objects, so it can be unit tested without bootstrapping Nest or a
database — which is why the whole suite runs in under half a second. It is a
folder rather than a package deliberately: the value is in dependencies pointing
one way, and a folder enforces that just as well as a workspace would, without
the build-ordering cost.

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

Three outcomes are kept distinct. A malformed body is **400**, rejected by the
global `ValidationPipe` against the DTO. A well-formed request describing a
mission that cannot be flown is **422** on save. And an evaluation that finds no
feasible craft is **200** with `anyFeasible: false` — a valid answer to a valid
question, so the client never has to treat it as an error.

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

Craft that cannot fly a route stay in the list, greyed out, with every reason
listed. Actionable failures are shown in amber, intrinsic ones in red and marked
as unfixable, so an agent can tell at a glance whether adjusting an input would
help. Hiding excluded options would be less work and considerably less useful.

The trajectory diagram draws the axis, the route, and a dashed arc for each body
flown around. Its horizontal scale is square-rooted — on a linear axis the four
inner planets collapse into a single pixel — and the caption says so.

Evaluation is a debounced call to the API rather than a local computation. One
execution path means the client's numbers and the server's numbers are provably
the same, and at this data size the round trip is imperceptible.

## Decisions and trade-offs

[ASSUMPTIONS.md](./ASSUMPTIONS.md) records what the brief stated, what was
interpreted and why, what was invented, and which fidelity limits were accepted
deliberately.

## Testing

106 tests across four layers. The first three run with `npm test` and need no
Docker; the end-to-end layer needs Postgres up.

**Domain (45).** Pure arithmetic with several easy-to-get-wrong edge cases, so
this is where the tests are concentrated: distance symmetry and identity, the
radius subtraction, detour counting, the turnaround exemption, consumption
monotonicity, and failure collection. No mocks, no fixtures beyond four synthetic
bodies with round numbers.

**API (35).** The real Nest application over supertest, using the same request
pipeline `main.ts` installs — both call the shared `configureApp`, so a test
cannot pass against a pipeline users do not hit. Covers the three distinct
outcomes, with the 422 path taken furthest: each failure mode separately, several
at once, the actionable flag, and a check that a refused mission is not
persisted.

The database is swapped for an in-memory double. The behaviour under test is the
HTTP contract, not Prisma's query building, and the 422 case is rejected before
any write. The trade-off: a mismatch between the code and the real schema is not
caught here — the end-to-end layer below exists for exactly that.

**Client (15).** The planner screen against a stubbed `fetch` returning the API's
real shapes. Covers the product decisions rather than the markup: excluded craft
stay visible with reasons, an excluded craft cannot be selected, saving is
blocked until a feasible craft is chosen, a 422 surfaces the server's reasons,
and — the contract the server depends on — a save sends inputs only, never a
distance or a duration.

### End to end (11)

```bash
docker compose up -d
npm run test:e2e
```

Playwright drives a real Chromium against the built API and a real Postgres, on
its own database and its own ports so it cannot disturb a dev server that is
already up. `migrate deploy` applies the committed migrations, so each run also
proves they apply cleanly from scratch.

This is the layer that covers what the in-memory double cannot: that the code and
the migrated schema actually agree. Dropping a single column from the database
leaves all 95 other tests passing and fails these. It checks the column types
that would really break — `String[]` for destination order, `Json` for the leg
breakdown and the spacecraft snapshot — plus the unique-reference constraint, and
the full agent journey: plan, save, reload the page, load back, amend, delete.

## Not built

- Cross-browser and mobile viewports — Playwright runs Chromium only
- Craft availability across saved missions — see ASSUMPTIONS.md
- Passenger pooling across bookings — see ASSUMPTIONS.md
