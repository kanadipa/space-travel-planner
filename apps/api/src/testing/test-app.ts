import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import { PrismaService } from '../prisma/prisma.service';

interface StoredMission {
  id: string;
  reference: string;
  [key: string]: unknown;
}

/**
 * The slice of Prisma the missions service actually uses, kept in memory.
 *
 * The alternative is a live Postgres, which would make `npm test` depend on
 * Docker being up. The behaviour under test here is the HTTP contract — status
 * codes, validation, serialisation — not Prisma's query building, and the most
 * important case (422) is rejected before any write happens. Persistence
 * against the real schema is covered by `prisma migrate` and by running the app.
 *
 * The trade-off this accepts: a mismatch between the code and the actual
 * database schema would not be caught here.
 */
class InMemoryMissions {
  private readonly rows = new Map<string, StoredMission>();

  findMany(): Promise<StoredMission[]> {
    const all = [...this.rows.values()];
    return Promise.resolve(all.reverse());
  }

  findUnique(args: { where: { id?: string; reference?: string } }): Promise<StoredMission | null> {
    const { id, reference } = args.where;

    if (id !== undefined) return Promise.resolve(this.rows.get(id) ?? null);

    const match = [...this.rows.values()].find((row) => row.reference === reference);
    return Promise.resolve(match ?? null);
  }

  create(args: { data: Record<string, unknown> & { reference: string } }): Promise<StoredMission> {
    const now = new Date();
    const row: StoredMission = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...args.data,
    };

    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<StoredMission> {
    const existing = this.rows.get(args.where.id);
    if (!existing) throw new Error(`No mission ${args.where.id}`);

    const row = { ...existing, ...args.data, updatedAt: new Date() } as StoredMission;
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  delete(args: { where: { id: string } }): Promise<void> {
    this.rows.delete(args.where.id);
    return Promise.resolve();
  }
}

/**
 * Boots the real application graph with the database swapped out.
 *
 * Everything else is genuine: the same modules, the same controllers, and the
 * same request pipeline `main.ts` installs, via the shared `configureApp`. The
 * catalogue is the real supplied YAML, resolved relative to the workspace.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({ mission: new InMemoryMissions() })
    .compile();

  const app = configureApp(moduleRef.createNestApplication());
  await app.init();

  return app;
}
