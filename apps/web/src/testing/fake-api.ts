import { vi } from 'vitest';
import type {
  CatalogResponse,
  Evaluation,
  EvaluationResponse,
  Mission,
  Spacecraft,
} from '../types';

const planet = (id: string, name: string, distanceFromSunKm: number, temp: number) => ({
  id,
  name,
  type: 'Planet' as const,
  distanceFromSunKm,
  diameterKm: 12000,
  averageTemperatureC: temp,
  potentiallyHabitable: false,
  moons: [],
});

export const catalog: CatalogResponse = {
  departure: { ...planet('earth', 'Earth', 149_600_000, 15), potentiallyHabitable: true },
  destinations: [
    planet('venus', 'Venus', 108_200_000, 464),
    planet('mars', 'Mars', 227_900_000, -65),
    planet('neptune', 'Neptune', 4_495_060_000, -200),
  ],
  excluded: [
    {
      body: { ...planet('sun', 'Sun', 0, 5505), type: 'Star' as const },
      reason: 'No craft in the fleet can operate at 5505 °C.',
    },
  ],
};

export const fleet: Spacecraft[] = [
  {
    id: 'serenity-xl',
    name: 'Serenity XL',
    size: 'Extra Large',
    capacity: 30,
    rangeKm: 15_000_000_000,
    travelSpeedKmPerHour: 500_000,
    gravityGenerator: true,
    operationalTemperatureCMin: -420,
    operationalTemperatureCMax: 500,
  },
  {
    id: 'galactica-scout',
    name: 'Galactica Scout',
    size: 'Small',
    capacity: 3,
    rangeKm: 500_000_000,
    travelSpeedKmPerHour: 600_000,
    gravityGenerator: false,
    operationalTemperatureCMin: -310,
    operationalTemperatureCMax: 555,
  },
  {
    id: 'millennial-hopper',
    name: 'Millennial Hopper',
    size: 'Small',
    capacity: 5,
    rangeKm: 400_000_000,
    travelSpeedKmPerHour: 500_000,
    gravityGenerator: true,
    operationalTemperatureCMin: -300,
    operationalTemperatureCMax: 150,
  },
];

const evaluation = (spacecraftId: string, feasible: boolean, failures: Evaluation['failures']) => ({
  spacecraftId,
  feasible,
  failures,
  itinerary: {
    legs: [
      {
        fromPlanetId: 'earth',
        toPlanetId: 'mars',
        surfaceDistanceKm: 78_290_239.5,
        passedPlanetIds: [],
        detourKm: 0,
        distanceKm: 78_290_239.5,
      },
      {
        fromPlanetId: 'mars',
        toPlanetId: 'earth',
        surfaceDistanceKm: 78_290_239.5,
        passedPlanetIds: [],
        detourKm: 0,
        distanceKm: 78_290_239.5,
      },
    ],
    exposedPlanetIds: ['earth', 'mars'],
    totalDistanceKm: 156_580_479,
  },
  consumptionRate: 1.168,
  rangeConsumedKm: 182_886_000,
  rangeUtilisation: 0.012,
  durationYears: 0.036,
});

/** One feasible craft, one blocked on capacity, one blocked on temperature. */
export const mixedEvaluation: EvaluationResponse = {
  anyFeasible: true,
  evaluations: [
    evaluation('serenity-xl', true, []),
    evaluation('galactica-scout', false, [
      {
        code: 'CAPACITY_EXCEEDED',
        actionable: true,
        message: 'Carries 3, 4 booked. Reduce the party to 3 or choose a larger craft.',
        detail: { capacity: 3, passengerCount: 4 },
      },
    ]),
    evaluation('millennial-hopper', false, [
      {
        code: 'TEMPERATURE_OUT_OF_BOUNDS',
        actionable: false,
        message: 'Cannot operate at Venus (464 °C, rated -300 to 150 °C).',
        detail: { planetName: 'Venus', planetTemperatureC: 464, minC: -300, maxC: 150 },
      },
    ]),
  ],
};

/** The one feasible craft is committed elsewhere over this window. */
export const feasibleButBusy: EvaluationResponse = {
  ...mixedEvaluation,
  busySpacecraftIds: ['serenity-xl'],
};

export const nothingFeasible: EvaluationResponse = {
  anyFeasible: false,
  evaluations: mixedEvaluation.evaluations.map((e) => ({
    ...e,
    feasible: false,
    failures: e.failures.length
      ? e.failures
      : [
          {
            code: 'OUT_OF_RANGE' as const,
            actionable: true,
            message: 'Short by 9,386,880,990 km.',
            detail: {},
          },
        ],
  })),
};

export const savedMission: Mission = {
  id: 'mission-1',
  reference: '8WDKQ',
  name: 'Mars · 2041-07-28 · 4 pax',
  spacecraftId: 'serenity-xl',
  passengerCount: 4,
  destinationIds: ['mars'],
  departureDate: '2041-07-28T00:00:00.000Z',
  arrivalDate: '2041-08-05T00:00:00.000Z',
  totalDistanceKm: 156_580_479,
  rangeConsumedKm: 182_886_000,
  durationYears: 0.036,
  legs: [],
  spacecraftSnapshot: fleet[0]!,
  createdAt: '2041-01-01T00:00:00.000Z',
};

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

interface FakeApiOptions {
  evaluation?: EvaluationResponse;
  missions?: Mission[];
  /** Status to fail `POST /missions` with, plus the body the API would return. */
  createRejects?: { status: number; body: unknown };
}

/**
 * Stubs `fetch` rather than the `api` module, so a change to a response shape
 * shows up here. Requests are recorded so a test can assert what was sent.
 */
export function installFakeApi(options: FakeApiOptions = {}) {
  const requests: RecordedRequest[] = [];
  let missions = options.missions ?? [];

  const json = (body: unknown, status = 200) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response);

  const fetchMock = vi.fn((input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const path = input.replace('/api', '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    requests.push({ method, path, body });

    if (method === 'GET' && path === '/planets') return json(catalog);
    if (method === 'GET' && path === '/spacecraft') return json(fleet);
    if (method === 'GET' && path === '/missions') return json(missions);

    if (method === 'POST' && path === '/evaluations') {
      return json(options.evaluation ?? mixedEvaluation);
    }

    if (method === 'POST' && path === '/missions') {
      if (options.createRejects) {
        return json(options.createRejects.body, options.createRejects.status);
      }
      missions = [savedMission, ...missions];
      return json(savedMission, 201);
    }

    if (method === 'PATCH' && path.startsWith('/missions/')) return json(savedMission);

    if (method === 'DELETE' && path.startsWith('/missions/')) {
      missions = [];
      return json(undefined, 204);
    }

    return json({ message: `Unhandled ${method} ${path}` }, 404);
  });

  vi.stubGlobal('fetch', fetchMock);

  return { requests };
}
