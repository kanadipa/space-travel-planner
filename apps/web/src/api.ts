import type { CatalogResponse, EvaluationResponse, Mission, Spacecraft } from './interfaces/types';

const BASE = '/api';

/** The inputs an agent supplies. Mirrors CreateMissionDto on the API. */
export interface MissionInput {
  spacecraftId: string;
  passengerCount: number;
  destinationIds: string[];
  departureDate: string;
  name?: string;
}

/** Carries the server's structured failure list so the UI can render reasons. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Request failed with ${status}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.json().catch(() => null));
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  planets: () => request<CatalogResponse>('/planets'),
  spacecraft: () => request<Spacecraft[]>('/spacecraft'),

  evaluate: (body: {
    passengerCount: number;
    destinationIds: string[];
    departureDate: string;
    /** Omitted when planning a new mission, so a saved plan never clashes with itself. */
    editingMissionId?: string;
  }) =>
    request<EvaluationResponse>('/evaluations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listMissions: () => request<Mission[]>('/missions'),
  getMission: (id: string) => request<Mission>(`/missions/${id}`),

  createMission: (body: MissionInput) =>
    request<Mission>('/missions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateMission: (id: string, body: Partial<MissionInput>) =>
    request<Mission>(`/missions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteMission: (id: string) => request<void>(`/missions/${id}`, { method: 'DELETE' }),
};
