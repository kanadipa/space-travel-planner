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
