import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../testing/test-app';

describe('health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  it('reports ok while the database answers', async () => {
    const response = await server().get('/api/health').expect(200);

    expect(response.body).toMatchObject({ status: 'ok', database: 'reachable' });
  });
});
