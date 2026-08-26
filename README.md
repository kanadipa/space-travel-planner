# Space mission planner

A prototype planning tool for space travel agents. An agent enters a party size and
a set of destinations; the application works out the trajectory, tells them which
spacecraft can fly it and why the others cannot, and saves the result as a mission
plan that can be reloaded later.

## Running it

You need **Node 20 or later** and **Docker Desktop running**. Postgres runs in a
container — you do not need to type any `docker` commands yourself.

```bash
open -a Docker
npm install
npm run dev
```

Then open **http://localhost:5173**.

`npm run dev` writes `apps/api/.env`, starts Postgres, waits for it, applies the
migrations, then runs both servers in one terminal. The web server waits for the
API to answer `/api/health` before it starts, so the first page load is not a wall
of proxy errors while Nest is still compiling. Every step checks before it acts, so
re-running it is also how you pick up a schema change.

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Setup, then both servers — API on 3000, web on 5173              |
| `npm run setup`     | The setup only, without starting the servers                     |
| `npm test`          | 150 unit, integration and component tests. Needs the database up |
| `npm run test:e2e`  | 4 browser tests through the full stack                           |
| `npm run typecheck` | Type-checks both workspaces                                      |
| `npm run lint`      | ESLint over both workspaces, the scripts and the e2e pass        |
| `npm run format`    | Prettier over the repo (`format:check` to verify only)           |
| `npm run db:down`   | Stops the Postgres container                                     |

## Repository layout

```
apps/api                 NestJS + Prisma
  src/domain/            planning logic — no Nest, no Prisma, no HTTP
  src/catalog/           loads the supplied YAML, normalises it
  src/planning/          evaluation endpoint over the domain layer
  src/missions/          persistence, DTOs, validation, availability
  src/app.setup.ts       the request pipeline, shared by main.ts and the tests
apps/web                 React + Vite client
  src/components/        controls, fleet list, trajectory, saved missions
  src/router.ts          the two screens
data/                    supplied planet and spacecraft data
e2e/                     Playwright: real browser, built API, real Postgres
scripts/setup.mjs        one-command first launch
```

`src/domain` imports nothing from the framework — plain objects in, plain objects
out — so the planning rules test without booting Nest or a database. A folder
rather than a package on purpose: the value is in dependencies pointing one way,
and a folder buys that without the build-ordering cost.

## The planning model

Every body sits on a single axis, placed by the supplied `distance_from_sun_km`,
so planning reduces to arithmetic on one dimension: legs are surface to surface
(`|d₁ − d₂| − r₁ − r₂`), a body in the way costs a half-circumference detour, and
range is consumed at `1 + 0.042 × passengers` per km — so reach _falls_ as
passengers are added.

Feasibility is four independent checks: capacity, range, the 42-year window, and
temperature at every body on the route including ones only flown around. None
depends on another, so all four run and every failure is reported, ordered by how
easily an agent can act on them.

The derivations — why a detour costs `πr − 2r` mid-leg but a full `πr` past a
stop, and why destination order cannot change the total — are in ASSUMPTIONS.md.

## API

| Method   | Path                | Purpose                                               |
| -------- | ------------------- | ----------------------------------------------------- |
| `GET`    | `/api/health`       | Liveness plus a real Postgres round trip              |
| `GET`    | `/api/planets`      | Selectable destinations, plus excluded bodies and why |
| `GET`    | `/api/spacecraft`   | The fleet                                             |
| `POST`   | `/api/evaluations`  | Evaluate the whole fleet against a proposed route     |
| `GET`    | `/api/missions`     | List saved plans                                      |
| `GET`    | `/api/missions/:id` | Load one                                              |
| `POST`   | `/api/missions`     | Save                                                  |
| `PATCH`  | `/api/missions/:id` | Amend and revalidate                                  |
| `DELETE` | `/api/missions/:id` | Remove                                                |

Four outcomes, kept distinct:

- **400** — malformed body, rejected by the global `ValidationPipe`.
- **422** — well formed, but the mission cannot be flown.
- **409** — flyable, but the craft is already committed. Names the mission in the way.
- **200 with `anyFeasible: false`** — no craft can fly it. A valid answer to a
  valid question, so the client never treats it as an error.

The client sends inputs only: craft, passenger count, destinations, departure
date. Everything else is recomputed server-side through the same domain functions
the evaluator uses, so a stale client cannot persist an impossible mission.

## The interface

- **One screen, not a wizard.** Passenger count and destinations at the top; the
  trajectory, totals and fleet update beneath them. Range consumption depends on
  party size, so changing it visibly changes which craft can fly the route.
- **The diagram is the control.** Planets are the buttons. Bodies sit in orbital
  order rather than to scale — the supplied spans run from 58 million to 4.5
  billion km, and any true scale stacks the four inner planets on each other.
- **The plan reads as a sentence** above the diagram, naming each stop with its
  weather, temperature, radiation and moons, then the total distance.
- **Ruled-out craft stay in the list** with a short reason each: amber when the
  agent can act on it, red when it is intrinsic to the craft and route. The
  server's full sentence is one hover or one tab-stop away.
- **A second route, `/missions`,** so the saved list is linkable and the back
  button behaves. Two paths is the whole requirement, which is why
  `src/router.ts` is a twenty-six-line hook over `history.pushState` rather than
  a dependency. Swapping in react-router later means replacing that hook and its
  two call sites.
- **Evaluation is a debounced call to the API,** not a local computation. One
  execution path means the client's numbers and the server's are provably the
  same, and at this size the round trip is imperceptible.

## Decisions and trade-offs

[ASSUMPTIONS.md](./ASSUMPTIONS.md) records what the brief stated, what was
interpreted and why, what was invented, and which fidelity limits were accepted
deliberately.

## Testing

Three layers, plus end-to-end. `npm test` runs the first three and needs the
database up; `npm run test:e2e` drives a real browser.

| Layer      | Count | What it is for                                                                                                  |
| ---------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| Domain     | 57    | The arithmetic, where the easy-to-get-wrong edges are. No mocks; four synthetic bodies with round numbers.      |
| API        | 44    | The real Nest app over supertest against real Postgres, through the pipeline `main.ts` installs.                |
| Client     | 49    | The planner against a stubbed `fetch`, plus the formatters and journey builders. Product decisions, not markup. |
| End to end | 4     | Chromium against the built API and the same Postgres.                                                           |

The choices worth knowing about:

- **The API tests use the real database,** so the `String[]` and `Json` columns and
  the unique-reference constraint behave as they actually do. The cost is that
  `npm test` needs Docker and empties the mission table on boot.
- **Both the API and the tests call `configureApp`,** so a test cannot pass against
  a request pipeline that users never hit.
- **One test asserts the client's half of the contract:** a save sends inputs only,
  never a distance or a duration.
- **The concurrency test fires eight simultaneous saves** and asserts the craft is
  taken exactly once. Eight requests and a warmed connection pool are both
  load-bearing — see [ASSUMPTIONS.md](./ASSUMPTIONS.md#booking-conflicts).

```bash
npm run test:e2e   # save a plan, reload, load it back, fail to double-book
```

## Craft availability

A craft committed over an overlapping window cannot be booked — not a date match,
so a craft that left for Jupiter in July is still in flight in September. The
fleet list marks it "already booked" and the save button goes dead, but the
browser only explains the rule; `POST /missions` answers **409** if asked anyway,
and concurrent saves are settled by a `SERIALIZABLE` transaction with retry.

Why 409 rather than 422, why availability is recomputed rather than stored, and
the three concurrency options weighed:
[ASSUMPTIONS.md](./ASSUMPTIONS.md#booking-conflicts).

## Not built

Deliberately out of scope for a prototype, roughly in the order they would matter.

- **Authentication and per-agent identity.** Every mission is anonymous; there is
  no way to say who booked what.
- **Structured logs, request correlation, and metrics.** The logs are plain text
  and nothing is aggregated. A dashboard on 409 rate and evaluation latency is
  where operational trouble would first show.
- **A reservation with a timeout,** so a craft is held between evaluating and
  saving rather than refused at the end.
- **Look-up by booking reference,** for an agent holding a code and no list.
- **Pagination on `GET /missions`.** It returns every mission and the client holds
  them all in memory — fine at prototype volumes, not beyond them.
- **Cross-browser and mobile viewports.** Playwright runs Chromium only.
- **Passenger pooling and turnaround time** — see ASSUMPTIONS.md. A craft landing
  as another departs counts as free.
