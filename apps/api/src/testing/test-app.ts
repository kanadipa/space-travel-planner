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
 * Empties the mission table.
 *
 * Needed per-test, not just per-file, now that saved missions occupy their craft:
 * two tests saving the same craft over the same dates are no longer independent,
 * and the second would be refused by a booking the first left behind.
 */
export async function clearMissions(app: INestApplication): Promise<void> {
  await app.get(PrismaService).mission.deleteMany();
}
