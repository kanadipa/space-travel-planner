#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Gets a fresh clone to a running database, idempotently.
 *
 * Every step checks before it acts, so this is safe to run on every `npm run
 * dev` — which is the point: nobody has to remember the order, and nobody hits
 * the two traps this used to have. Postgres accepts connections some seconds
 * after `docker compose up -d` returns, so migrating immediately is a race; and
 * the Prisma client has to exist before the API will typecheck.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const api = resolve(root, 'apps/api');

/** `--db-only` skips the env file and Prisma: used by the e2e run, which brings
 *  its own database URL and applies migrations itself. `--dev` only changes the
 *  closing message, because the servers are about to start. */
const dbOnly = process.argv.includes('--db-only');
const thenDev = process.argv.includes('--dev');

const step = (message) => console.log(`\n[36m▸[0m ${message}`);
const done = (message) => console.log(`  [32m✓[0m ${message}`);

function fail(message, hint) {
  console.error(`\n[31m✗ ${message}[0m`);
  if (hint) console.error(`  ${hint}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, ...options });
}

function quiet(command, args, options = {}) {
  return spawnSync(command, args, { cwd: root, stdio: 'pipe', shell: false, ...options });
}

// 1. Environment file ────────────────────────────────────────────────────────
if (!dbOnly) {
  step('Checking environment');

  const envFile = resolve(api, '.env');
  if (existsSync(envFile)) {
    done('apps/api/.env already present');
  } else {
    copyFileSync(resolve(api, '.env.example'), envFile);
    done('created apps/api/.env from .env.example');
  }
}

// 2. Docker ──────────────────────────────────────────────────────────────────
step('Starting Postgres');

if (quiet('docker', ['info']).status !== 0) {
  fail(
    'Docker is not available.',
    'Start Docker Desktop and run this again. The app needs Postgres for the String[] and Json columns.',
  );
}

if (run('docker', ['compose', 'up', '-d']).status !== 0) {
  fail('docker compose up failed.', 'Is something else already bound to port 5432?');
}

// 3. Wait for readiness ──────────────────────────────────────────────────────
// `up -d` returns once the container is created, not once Postgres is accepting
// connections. Migrating in between is the race this loop removes.
process.stdout.write('  waiting for Postgres to accept connections');

const deadline = Date.now() + 60_000;
let ready = false;

while (Date.now() < deadline) {
  if (quiet('docker', ['compose', 'exec', '-T', 'db', 'pg_isready', '-U', 'smp']).status === 0) {
    ready = true;
    break;
  }
  process.stdout.write('.');
  execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 1000)']);
}

process.stdout.write('\n');
if (!ready) fail('Postgres did not become ready within 60s.', 'Check `docker compose logs db`.');
done('Postgres is accepting connections');

// 4. Prisma ─────────────────────────────────────────────────────────────────────────
if (!dbOnly) {
  step('Applying the database schema');

  if (run('npx', ['prisma', 'migrate', 'deploy'], { cwd: api }).status !== 0) {
    fail('prisma migrate deploy failed.', 'Check DATABASE_URL in apps/api/.env.');
  }
  done('schema is up to date');

  // The client is generated on postinstall too; regenerating here keeps it in
  // step with a schema change someone just pulled.
  if (run('npx', ['prisma', 'generate'], { cwd: api, stdio: 'ignore' }).status !== 0) {
    fail('prisma generate failed.');
  }
  done('Prisma client generated');
}

if (thenDev) {
  console.log('\n\x1b[32mReady.\x1b[0m Starting the API and the web client\u2026\n');
} else if (!dbOnly) {
  console.log('\n\x1b[32mReady.\x1b[0m Run `npm run dev` to start the app.\n');
}
