import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../testing/test-app';

describe('catalogue endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  it('departs from Earth and offers the other planets', async () => {
    const response = await server().get('/api/planets').expect(200);

    expect(response.body.departure.id).toBe('earth');
    expect(response.body.destinations.map((p: { id: string }) => p.id)).toEqual([
      'mercury',
      'venus',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
    ]);
  });

  /**
   * The Sun is excluded because no craft survives 5,505 °C, not because its type
   * is Star. Asserting the reason rather than the absence keeps the rule
   * data-driven — a hot planet would drop out the same way.
   */
  it('excludes the Sun on temperature, with a reason', async () => {
    const response = await server().get('/api/planets').expect(200);

    const sun = response.body.excluded.find(
      (entry: { body: { id: string } }) => entry.body.id === 'sun',
    );

    expect(sun).toBeDefined();
    expect(sun.reason).toContain('5505');
    expect(sun.reason).toContain('°C');
  });

  it('returns the whole fleet', async () => {
    const response = await server().get('/api/spacecraft').expect(200);

    expect(response.body).toHaveLength(6);
    expect(response.body[0]).toMatchObject({
      id: expect.any(String),
      capacity: expect.any(Number),
      rangeKm: expect.any(Number),
    });
  });
});
