import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../testing/test-app';

describe('POST /api/evaluations', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  it('evaluates the whole fleet and reports the feasible ones', async () => {
    const response = await server()
      .post('/api/evaluations')
      .send({ passengerCount: 4, destinationIds: ['mars'], departureDate: '2041-01-01' })
      .expect(200);

    expect(response.body.anyFeasible).toBe(true);
    expect(response.body.evaluations).toHaveLength(6);
    expect(response.body.evaluations.some((e: { feasible: boolean }) => e.feasible)).toBe(true);
  });

  it('returns 200 with anyFeasible false rather than an error when nothing can fly', async () => {
    const response = await server()
      .post('/api/evaluations')
      .send({ passengerCount: 21, destinationIds: ['neptune'], departureDate: '2041-01-01' })
      .expect(200);

    expect(response.body.anyFeasible).toBe(false);
    expect(response.body.evaluations.every((e: { feasible: boolean }) => !e.feasible)).toBe(true);
  });

  it('keeps excluded craft in the response with their reasons', async () => {
    const response = await server()
      .post('/api/evaluations')
      .send({ passengerCount: 21, destinationIds: ['neptune'], departureDate: '2041-01-01' })
      .expect(200);

    const excluded = response.body.evaluations.filter((e: { feasible: boolean }) => !e.feasible);

    expect(excluded.length).toBeGreaterThan(0);
    for (const evaluation of excluded) {
      expect(evaluation.failures.length).toBeGreaterThan(0);
      expect(evaluation.failures[0]).toHaveProperty('code');
      expect(evaluation.failures[0]).toHaveProperty('message');
    }
  });

  it('orders actionable failures before intrinsic ones', async () => {
    const response = await server()
      .post('/api/evaluations')
      .send({
        passengerCount: 2,
        destinationIds: ['mercury', 'venus'],
        departureDate: '2041-01-01',
      })
      .expect(200);

    for (const evaluation of response.body.evaluations) {
      const actionable = evaluation.failures.map((f: { actionable: boolean }) => f.actionable);
      const sorted = [...actionable].sort((a, b) => Number(b) - Number(a));
      expect(actionable).toEqual(sorted);
    }
  });

  it('reports temperature failures inward and range failures outward', async () => {
    const inward = await server()
      .post('/api/evaluations')
      .send({ passengerCount: 2, destinationIds: ['venus'], departureDate: '2041-01-01' })
      .expect(200);

    const outward = await server()
      .post('/api/evaluations')
      .send({ passengerCount: 2, destinationIds: ['neptune'], departureDate: '2041-01-01' })
      .expect(200);

    const codes = (body: { evaluations: { failures: { code: string }[] }[] }) =>
      body.evaluations.flatMap((e) => e.failures.map((f) => f.code));

    expect(codes(inward.body)).toContain('TEMPERATURE_OUT_OF_BOUNDS');
    expect(codes(outward.body)).toContain('OUT_OF_RANGE');
  });

  describe('rejects a malformed body with 400', () => {
    it.each([
      ['a non-integer passenger count', { passengerCount: 'lots' }],
      ['zero passengers', { passengerCount: 0 }],
      ['no destinations', { destinationIds: [] }],
      ['an unparseable date', { departureDate: 'not-a-date' }],
    ])('%s', async (_label, override) => {
      await server()
        .post('/api/evaluations')
        .send({
          passengerCount: 4,
          destinationIds: ['mars'],
          departureDate: '2041-01-01',
          ...override,
        })
        .expect(400);
    });
  });

  it('rejects fields the DTO does not declare', async () => {
    await server()
      .post('/api/evaluations')
      .send({
        passengerCount: 4,
        destinationIds: ['mars'],
        departureDate: '2041-01-01',
        totalDistanceKm: 1,
      })
      .expect(400);
  });
});
