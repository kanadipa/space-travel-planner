import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { clearMissions, createTestApp } from '../testing/test-app';

const FLYABLE = {
  spacecraftId: 'serenity-xl',
  passengerCount: 4,
  destinationIds: ['mars'],
  departureDate: '2041-03-01',
};

describe('missions', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  /* Every test saves the same craft over the same dates, which the availability
     rule now treats as a clash. A clean calendar keeps them independent. */
  beforeEach(async () => {
    await clearMissions(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  const create = async (overrides: Record<string, unknown> = {}) => {
    const response = await server()
      .post('/api/missions')
      .send({ ...FLYABLE, ...overrides })
      .expect(201);

    return response.body;
  };

  describe('POST /api/missions', () => {
    it('saves a flyable mission and allocates a quotable reference', async () => {
      const mission = await create();

      expect(mission.id).toBeTruthy();
      expect(mission.reference).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    });

    it('derives the figures server-side rather than taking them from the client', async () => {
      const mission = await create();

      expect(mission.totalDistanceKm).toBeGreaterThan(0);
      expect(mission.rangeConsumedKm).toBeGreaterThan(mission.totalDistanceKm);
      expect(mission.durationYears).toBeGreaterThan(0);
      expect(mission.legs).toHaveLength(2);
      expect(new Date(mission.arrivalDate).getTime()).toBeGreaterThan(
        new Date(mission.departureDate).getTime(),
      );
    });

    it('snapshots the spacecraft so later data changes cannot rewrite an agreed plan', async () => {
      const mission = await create();

      expect(mission.spacecraftSnapshot).toMatchObject({ id: 'serenity-xl' });
    });

    it('falls back to a derived name when the agent supplies none', async () => {
      const mission = await create();

      expect(mission.name).toContain('Mars');
      expect(mission.name).toContain('4 pax');
    });

    it('keeps a supplied name', async () => {
      const mission = await create({ name: 'Honeymoon' });

      expect(mission.name).toBe('Honeymoon');
    });

    it('rejects a computed field the client tried to assert', async () => {
      await server()
        .post('/api/missions')
        .send({ ...FLYABLE, totalDistanceKm: 1 })
        .expect(400);
    });

    it('rejects a malformed body with 400', async () => {
      await server()
        .post('/api/missions')
        .send({ ...FLYABLE, passengerCount: 'four' })
        .expect(400);
    });
  });

  describe('422 — well-formed but unflyable', () => {
    it('refuses a mission beyond the craft range', async () => {
      const response = await server()
        .post('/api/missions')
        .send({ ...FLYABLE, spacecraftId: 'millennial-hopper', destinationIds: ['neptune'] })
        .expect(422);

      expect(response.body.message).toBe('This mission cannot be flown as configured.');
      expect(response.body.failures.map((f: { code: string }) => f.code)).toContain('OUT_OF_RANGE');
    });

    it('refuses a party larger than the craft capacity', async () => {
      const response = await server()
        .post('/api/missions')
        .send({ ...FLYABLE, spacecraftId: 'galactica-scout', passengerCount: 4 })
        .expect(422);

      expect(response.body.failures.map((f: { code: string }) => f.code)).toContain(
        'CAPACITY_EXCEEDED',
      );
    });

    it('refuses a route with a body outside the craft temperature range', async () => {
      const response = await server()
        .post('/api/missions')
        .send({ ...FLYABLE, spacecraftId: 'millennial-hopper', destinationIds: ['venus'] })
        .expect(422);

      expect(response.body.failures.map((f: { code: string }) => f.code)).toContain(
        'TEMPERATURE_OUT_OF_BOUNDS',
      );
    });

    it('reports every reason at once rather than stopping at the first', async () => {
      const response = await server()
        .post('/api/missions')
        .send({
          ...FLYABLE,
          spacecraftId: 'galactica-scout',
          passengerCount: 4,
          destinationIds: ['neptune'],
        })
        .expect(422);

      const codes = response.body.failures.map((f: { code: string }) => f.code);
      expect(codes).toContain('CAPACITY_EXCEEDED');
      expect(codes).toContain('OUT_OF_RANGE');
    });

    it('marks failures as actionable or not so the client can say which are fixable', async () => {
      const response = await server()
        .post('/api/missions')
        .send({ ...FLYABLE, spacecraftId: 'millennial-hopper', destinationIds: ['neptune'] })
        .expect(422);

      for (const failure of response.body.failures) {
        expect(typeof failure.actionable).toBe('boolean');
        expect(failure.message.length).toBeGreaterThan(0);
      }
    });

    it('does not persist anything it refused', async () => {
      const before = await server().get('/api/missions').expect(200);

      await server()
        .post('/api/missions')
        .send({ ...FLYABLE, spacecraftId: 'millennial-hopper', destinationIds: ['neptune'] })
        .expect(422);

      const after = await server().get('/api/missions').expect(200);
      expect(after.body).toHaveLength(before.body.length);
    });
  });

  describe('409 — the craft is already committed', () => {
    it('refuses a second mission on a craft over overlapping dates', async () => {
      await create();

      const response = await server().post('/api/missions').send(FLYABLE).expect(409);

      expect(response.body.message).toContain('Serenity XL');
      expect(response.body.conflicts).toHaveLength(1);
    });

    it('names the mission in the way, so the agent can go and look at it', async () => {
      const first = await create({ name: 'Honeymoon' });

      const response = await server().post('/api/missions').send(FLYABLE).expect(409);

      expect(response.body.message).toContain(first.reference);
      expect(response.body.conflicts[0]).toMatchObject({
        missionId: first.id,
        reference: first.reference,
        name: 'Honeymoon',
      });
    });

    it('does not persist the mission it refused', async () => {
      await create();

      await server().post('/api/missions').send(FLYABLE).expect(409);

      const all = await server().get('/api/missions').expect(200);
      expect(all.body).toHaveLength(1);
    });

    it('allows the same craft once the first mission is over', async () => {
      const first = await create();

      /* The craft is free the instant it lands: no turnaround is modelled. */
      await server()
        .post('/api/missions')
        .send({ ...FLYABLE, departureDate: first.arrivalDate })
        .expect(201);
    });

    it('allows a different craft over the same dates', async () => {
      await create();

      await server()
        .post('/api/missions')
        .send({ ...FLYABLE, spacecraftId: 'galactica-scout', passengerCount: 3 })
        .expect(201);
    });

    /* Physics first: a mission that cannot be flown is 422 whether or not the
       craft is also busy, because the payload is the thing to fix. */
    it('reports infeasibility rather than the clash when both apply', async () => {
      await create();

      await server()
        .post('/api/missions')
        .send({ ...FLYABLE, passengerCount: 999 })
        .expect(422);
    });

    it('lets a saved mission be amended without clashing with itself', async () => {
      const mission = await create();

      await server().patch(`/api/missions/${mission.id}`).send({ name: 'Renamed' }).expect(200);
    });

    it('refuses an amendment that moves a mission onto a booked window', async () => {
      const first = await create();
      const second = await create({ departureDate: first.arrivalDate });

      const response = await server()
        .patch(`/api/missions/${second.id}`)
        .send({ departureDate: FLYABLE.departureDate })
        .expect(409);

      expect(response.body.conflicts[0]).toMatchObject({ missionId: first.id });
    });

    /*
     * Eight requests and a warmed pool are both load-bearing: a pair does not
     * overlap, and a cold pool serialises the burst while it opens connections.
     * Drop either and this passes at READ COMMITTED. See ASSUMPTIONS.md.
     */
    it('lets only one of a burst of simultaneous saves take the craft', async () => {
      await Promise.all(Array.from({ length: 8 }, () => server().get('/api/missions')));

      const responses = await Promise.all(
        Array.from({ length: 8 }, () => server().post('/api/missions').send(FLYABLE)),
      );

      const created = responses.filter((response) => response.status === 201);
      const refused = responses.filter((response) => response.status === 409);

      expect(created).toHaveLength(1);
      expect(refused).toHaveLength(7);

      const saved = await server().get('/api/missions').expect(200);
      expect(saved.body).toHaveLength(1);
    });

    it('allocates distinct references when saves land together', async () => {
      const responses = await Promise.all([
        server().post('/api/missions').send(FLYABLE),
        server()
          .post('/api/missions')
          .send({ ...FLYABLE, spacecraftId: 'nyx-odyssey' }),
        server()
          .post('/api/missions')
          .send({ ...FLYABLE, spacecraftId: 'star-explorer-1' }),
      ]);

      for (const response of responses) expect(response.status).toBe(201);

      const references = responses.map((response) => response.body.reference);
      expect(new Set(references).size).toBe(3);
    });
  });

  describe('reading', () => {
    it('loads by id', async () => {
      const mission = await create();

      const response = await server().get(`/api/missions/${mission.id}`).expect(200);
      expect(response.body.id).toBe(mission.id);
    });

    it('404s for an unknown id', async () => {
      await server().get('/api/missions/does-not-exist').expect(404);
    });
  });

  describe('PATCH /api/missions/:id', () => {
    it('recomputes the derived figures from the amended inputs', async () => {
      const mission = await create();

      const response = await server()
        .patch(`/api/missions/${mission.id}`)
        .send({ passengerCount: 8 })
        .expect(200);

      expect(response.body.passengerCount).toBe(8);
      expect(response.body.rangeConsumedKm).toBeGreaterThan(mission.rangeConsumedKm);
      expect(response.body.totalDistanceKm).toBe(mission.totalDistanceKm);
    });

    it('revalidates and refuses an amendment that makes the mission unflyable', async () => {
      const mission = await create({ spacecraftId: 'millennial-hopper' });

      await server()
        .patch(`/api/missions/${mission.id}`)
        .send({ destinationIds: ['neptune'] })
        .expect(422);
    });

    it('404s for an unknown id', async () => {
      await server().patch('/api/missions/does-not-exist').send({ passengerCount: 2 }).expect(404);
    });
  });

  describe('DELETE /api/missions/:id', () => {
    it('removes the mission and then 404s', async () => {
      const mission = await create();

      await server().delete(`/api/missions/${mission.id}`).expect(204);
      await server().get(`/api/missions/${mission.id}`).expect(404);
    });

    it('404s for an unknown id', async () => {
      await server().delete('/api/missions/does-not-exist').expect(404);
    });
  });
});
