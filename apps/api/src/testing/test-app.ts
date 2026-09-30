import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The real application over the real database, with the mission table emptied so
 * a run does not depend on what the last one left behind.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = configureApp(moduleRef.createNestApplication());
  await app.init();

  /*
   * Listening explicitly, rather than letting supertest do it per request.
   * `request(app.getHttpServer())` starts a server when the one it is handed has
   * no address, and closes it again when that request ends — so a concurrent
   * burst has several requests each starting one, and the first to finish closes
   * the socket out from under the rest. That surfaces as ECONNRESET, which reads
   * like the API dropped the connection when nothing of the sort happened.
   */
  await app.listen(0);

  await clearMissions(app);

  return app;
}

/**
 * Empties the mission table. Per-test, not per-file: a saved mission occupies its
 * craft, so the next test's identical save would be refused by the leftover.
 */
export async function clearMissions(app: INestApplication): Promise<void> {
  await app.get(PrismaService).mission.deleteMany();
}
