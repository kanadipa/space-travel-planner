# Space mission planner

A prototype planning tool for space travel agents. An agent enters a party size and
a set of destinations; the application works out the trajectory, tells them which
spacecraft can fly it and why the others cannot, and saves the result as a mission
plan that can be reloaded later.

![The planner screen: a two-stop route to Mars and Jupiter, with live totals and
the fleet evaluated against it](./docs/planner.jpg)

## Running it

Requires Node 20 or later and Docker.

```bash
git clone <repo> && cd space-mission-planner
npm install

docker compose up -d                         # Postgres on 5432
cp apps/api/.env.example apps/api/.env
npm run prisma:migrate -w @smp/api

npm run api:dev                              # http://localhost:3000/api
```

In a second terminal:

```bash
npm run web:dev                              # http://localhost:5173
```

Tests:

```bash
npm test
```

The domain tests need neither the database nor the Prisma client. Typechecking the
API does need the client, so run `npm run prisma:migrate -w @smp/api` (or
`prisma:generate`) before `npm run typecheck --workspaces`.

Without Docker: set the `datasource` provider in `apps/api/prisma/schema.prisma`
to `sqlite` and `DATABASE_URL="file:./dev.db"`. Postgres-specific columns
(`String[]`, `Json`) would need to become serialised strings, so the Docker path
is the supported one.

## Repository layout

```
apps/api             NestJS + Prisma
  src/domain/        planning logic — no Nest, no Prisma, no HTTP
  src/catalog/       loads the supplied YAML, normalises it
  src/planning/      the only caller of the domain layer
  src/missions/      persistence, DTOs, validation
apps/web             React + Vite client
data/                supplied planet and spacecraft data
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

95 tests across three layers, all runnable with `npm test` and no Docker.

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
caught here — `prisma migrate` and running the app cover that.

**Client (15).** The planner screen against a stubbed `fetch` returning the API's
real shapes. Covers the product decisions rather than the markup: excluded craft
stay visible with reasons, an excluded craft cannot be selected, saving is
blocked until a feasible craft is chosen, a 422 surfaces the server's reasons,
and — the contract the server depends on — a save sends inputs only, never a
distance or a duration.

## Not built

- End-to-end tests against a real database and browser
- Craft availability across saved missions — see ASSUMPTIONS.md
- Passenger pooling across bookings — see ASSUMPTIONS.md
