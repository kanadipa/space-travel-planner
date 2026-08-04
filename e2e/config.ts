/**
 * Fixed values shared by the Playwright config and the global setup.
 *
 * The end-to-end run uses its own database and its own ports so it cannot
 * collide with, or destroy the data of, a dev server someone already has up.
 */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://smp:smp@localhost:5432/smp_e2e?schema=public';

export const API_PORT = 3100;
export const WEB_PORT = 5199;

export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
