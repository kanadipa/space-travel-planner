import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { E2E_DATABASE_URL } from './config';

/**
 * Brings the end-to-end database up to the real schema, then empties it.
 *
 * `migrate deploy` applies the committed migrations rather than generating one,
 * so this run exercises the same SQL a deployment would. That is the whole point
 * of this layer: the unit and integration suites swap Prisma for a double, so a
 * mismatch between the code and the actual schema is invisible to them.
 */
export default async function globalSetup(): Promise<void> {
  const schema = resolve(__dirname, '../apps/api/prisma/schema.prisma');

  execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema', schema], {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'inherit',
  });

  const prisma = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });

  try {
    await prisma.mission.deleteMany();
  } finally {
    await prisma.$disconnect();
  }
}
