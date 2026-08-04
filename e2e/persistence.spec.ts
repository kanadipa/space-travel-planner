import { expect, test } from '@playwright/test';
import { API_URL } from './config';

/**
 * The gap the other suites cannot cover.
 *
 * The unit and integration tests swap Prisma for an in-memory double, so they
 * would pass even if the code and the migrated schema disagreed. These go
 * through the real client against real tables, and check the column types that
 * would actually break: `String[]` for the destination order and `Json` for the
 * leg breakdown and the spacecraft snapshot.
 */
test.describe('persistence against the real schema', () => {
  const flyable = {
    spacecraftId: 'serenity-xl',
    passengerCount: 4,
    destinationIds: ['jupiter', 'mars'],
    departureDate: '2041-03-01T00:00:00.000Z',
  };

  test('round-trips array and JSON columns unchanged', async ({ request }) => {
    const created = await (await request.post(`${API_URL}/api/missions`, { data: flyable })).json();

    const reloaded = await (await request.get(`${API_URL}/api/missions/${created.id}`)).json();

    // String[] — order is the agent's choice and must survive verbatim.
    expect(reloaded.destinationIds).toEqual(['jupiter', 'mars']);

    // Json — the leg breakdown, with its nested array of passed bodies.
    expect(Array.isArray(reloaded.legs)).toBe(true);
    expect(reloaded.legs.length).toBeGreaterThan(0);
    expect(reloaded.legs[0]).toMatchObject({
      fromPlanetId: expect.any(String),
      toPlanetId: expect.any(String),
      distanceKm: expect.any(Number),
      passedPlanetIds: expect.any(Array),
    });

    // Json — the snapshot that stops later data changes rewriting an agreed plan.
    expect(reloaded.spacecraftSnapshot).toMatchObject({
      id: 'serenity-xl',
      capacity: expect.any(Number),
      rangeKm: expect.any(Number),
    });

    // Float and DateTime columns.
    expect(reloaded.totalDistanceKm).toBeCloseTo(created.totalDistanceKm, 6);
    expect(new Date(reloaded.arrivalDate).getTime()).toBeGreaterThan(
      new Date(reloaded.departureDate).getTime(),
    );
  });

  test('enforces the unique reference constraint in the database', async ({ request }) => {
    const a = await (await request.post(`${API_URL}/api/missions`, { data: flyable })).json();
    const b = await (await request.post(`${API_URL}/api/missions`, { data: flyable })).json();

    expect(a.reference).not.toBe(b.reference);

    const byReference = await request.get(`${API_URL}/api/missions/reference/${a.reference}`);
    expect(byReference.status()).toBe(200);
    expect((await byReference.json()).id).toBe(a.id);
  });

  test('refuses an unflyable mission with 422 and writes nothing', async ({ request }) => {
    const before = await (await request.get(`${API_URL}/api/missions`)).json();

    const response = await request.post(`${API_URL}/api/missions`, {
      data: { ...flyable, spacecraftId: 'millennial-hopper', destinationIds: ['neptune'] },
    });

    expect(response.status()).toBe(422);
    expect((await response.json()).failures.map((f: { code: string }) => f.code)).toContain(
      'OUT_OF_RANGE',
    );

    const after = await (await request.get(`${API_URL}/api/missions`)).json();
    expect(after.length).toBe(before.length);
  });

  test('deletes for real rather than only from the client', async ({ request }) => {
    const created = await (await request.post(`${API_URL}/api/missions`, { data: flyable })).json();

    expect((await request.delete(`${API_URL}/api/missions/${created.id}`)).status()).toBe(204);
    expect((await request.get(`${API_URL}/api/missions/${created.id}`)).status()).toBe(404);
  });
});
