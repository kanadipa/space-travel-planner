#!/usr/bin/env node

/**
 * Holds the web server back until the API answers.
 *
 * `npm run dev` starts both at once, but Nest needs a few seconds to compile and
 * bind while Vite serves immediately. The browser then asks for the catalogue,
 * and the proxy fills the terminal with ECONNREFUSED before anything is wrong.
 * Same reason `setup.mjs` waits on `pg_isready` rather than trusting `up -d`.
 */

const base = process.env.API_URL ?? 'http://localhost:3000';
const health = `${base}/api/health`;
const deadline = Date.now() + 60_000;

process.stdout.write('waiting for the API');

while (Date.now() < deadline) {
  try {
    const response = await fetch(health);
    if (response.ok) {
      process.stdout.write('\n');
      process.exit(0);
    }
  } catch {
    // Not listening yet, which is the case this script exists for.
  }

  process.stdout.write('.');
  await new Promise((wake) => setTimeout(wake, 500));
}

process.stdout.write('\n');
console.error(`The API did not answer at ${health} within 60s.`);
process.exit(1);
