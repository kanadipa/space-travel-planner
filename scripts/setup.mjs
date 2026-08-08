#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Gets a fresh clone to a running, migrated database. Safe to re-run. */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const api = resolve(root, 'apps/api');

const run = (command, args, cwd = root) =>
  spawnSync(command, args, { cwd, stdio: 'inherit' }).status === 0;

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const envFile = resolve(api, '.env');
if (!existsSync(envFile)) copyFileSync(resolve(api, '.env.example'), envFile);

if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  fail('Docker is not running. Start Docker Desktop and try again.');
}

if (!run('docker', ['compose', 'up', '-d'])) {
  fail('docker compose up failed. Is something already bound to port 5432?');
}

// `up -d` returns once the container exists, not once Postgres is accepting
// connections. Migrating in between is the race this loop removes.
process.stdout.write('waiting for Postgres');
const deadline = Date.now() + 60_000;
let ready = false;

while (!ready && Date.now() < deadline) {
  const check = ['compose', 'exec', '-T', 'db', 'pg_isready', '-U', 'smp'];
  ready = spawnSync('docker', check, { cwd: root, stdio: 'ignore' }).status === 0;
  if (!ready) {
    process.stdout.write('.');
    await new Promise((wake) => setTimeout(wake, 1000));
  }
}

process.stdout.write('\n');
if (!ready) fail('Postgres did not accept connections within 60s. Try `docker compose logs db`.');

if (!run('npx', ['prisma', 'migrate', 'deploy'], api)) {
  fail('prisma migrate deploy failed. Check DATABASE_URL in apps/api/.env.');
}

// Generated from apps/api rather than the root: the client records where to look
// for the .env file, and generating from the root points it at one that is not
// there, so DATABASE_URL resolves to nothing.
if (!run('npx', ['prisma', 'generate'], api)) fail('prisma generate failed.');
