import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL } from './config';

const REFERENCE = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}/;

/**
 * Scoped to the two named regions.
 *
 * A saved mission's summary line also names its spacecraft, so an unscoped
 * `getByRole('button', { name: /Serenity XL/ })` matches craft cards and saved
 * rows alike once anything has been saved.
 */
const fleet = (page: Page) => page.getByRole('region', { name: 'Spacecraft' });
const saved = (page: Page) => page.getByRole('region', { name: 'Saved missions' });

async function clearMissions(request: APIRequestContext): Promise<void> {
  const missions = await (await request.get(`${API_URL}/api/missions`)).json();
  for (const mission of missions) {
    await request.delete(`${API_URL}/api/missions/${mission.id}`);
  }
}

/** Waits for the debounced evaluation to land rather than assuming a delay. */
async function planRouteTo(page: Page, ...bodies: string[]): Promise<void> {
  for (const body of bodies) {
    await page.getByRole('button', { name: new RegExp(`^${body}`) }).click();
  }
  await expect(page.getByText(/can fly this route/)).toBeVisible();
  await expect(fleet(page).getByRole('button').first()).toBeVisible();
}

async function saveMission(page: Page, craft = /Serenity XL/): Promise<string> {
  await fleet(page).getByRole('button', { name: craft }).click();
  await page.getByRole('button', { name: 'Save mission' }).click();
  await expect(page.getByText(/Saved as/)).toBeVisible();

  return (await page.getByText(/Saved as/).textContent())!.match(REFERENCE)![0];
}

test.beforeEach(async ({ page, request }) => {
  await clearMissions(request);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mission planner' })).toBeVisible();
});

test('loads the real catalogue and excludes the Sun on temperature', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^Mercury/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Neptune/ })).toBeVisible();

  await expect(page.getByText(/Not offered/)).toContainText('Sun');
  await expect(page.getByText(/Not offered/)).toContainText('5505 °C');
  await expect(page.getByRole('button', { name: /^Sun/ })).toHaveCount(0);
});

test('evaluates the real fleet and keeps excluded craft visible with reasons', async ({ page }) => {
  await planRouteTo(page, 'Mars');

  await expect(page.getByText(/of 6 can fly this route/)).toBeVisible();
  await expect(fleet(page).getByText('Serenity XL')).toBeVisible();

  // Capacity 3 against the default party of 4.
  const scout = fleet(page).getByRole('button', { name: /Galactica Scout/ });
  await expect(scout).toBeDisabled();
  await expect(scout).toContainText('Carries 3, 4 booked');
});

test('reports that nothing can fly a route beyond the fleet', async ({ page }) => {
  await page.getByRole('slider').fill('21');
  await planRouteTo(page, 'Neptune');

  await expect(page.getByText('0 of 6 can fly this route')).toBeVisible();
  await expect(page.getByText(/Nothing in the fleet can fly this route/)).toBeVisible();
});

test('saves a mission that survives a full page reload', async ({ page }) => {
  await planRouteTo(page, 'Mars');
  const reference = await saveMission(page);

  // The real proof of persistence: a new page load, served from Postgres.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mission planner' })).toBeVisible();
  await expect(saved(page).getByText(reference)).toBeVisible();
});

test('loads a saved mission back into the planner', async ({ page }) => {
  await planRouteTo(page, 'Jupiter');
  const reference = await saveMission(page);

  await page.reload();

  // Start from a different plan, then load the saved one over it.
  await planRouteTo(page, 'Mars');
  await expect(page.getByRole('button', { name: /^Mars/ })).toHaveAttribute('aria-pressed', 'true');

  // Anchored: the delete control's label also contains the reference.
  await saved(page).getByRole('button', { name: new RegExp(`^${reference}`) }).click();

  await expect(page.getByRole('button', { name: /^Jupiter/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: /^Mars/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('recomputes on the server when a saved mission is amended', async ({ page, request }) => {
  await planRouteTo(page, 'Mars');
  const reference = await saveMission(page);

  const before = await (await request.get(`${API_URL}/api/missions/reference/${reference}`)).json();

  // More passengers raises consumption, so the range consumed must rise with it.
  await page.getByRole('slider').fill('12');
  await expect(page.getByText(/12 aboard/)).toBeVisible();
  await fleet(page).getByRole('button', { name: /Serenity XL/ }).click();
  await page.getByRole('button', { name: 'Update mission' }).click();

  await expect
    .poll(async () => {
      const row = await (
        await request.get(`${API_URL}/api/missions/reference/${reference}`)
      ).json();
      return row.passengerCount;
    })
    .toBe(12);

  const after = await (await request.get(`${API_URL}/api/missions/reference/${reference}`)).json();

  expect(after.rangeConsumedKm).toBeGreaterThan(before.rangeConsumedKm);
  expect(after.totalDistanceKm).toBeCloseTo(before.totalDistanceKm, 3);
});

test('deletes a mission and it stays gone after a reload', async ({ page }) => {
  await planRouteTo(page, 'Saturn');
  const reference = await saveMission(page);

  await page.getByRole('button', { name: `Delete mission ${reference}` }).click();
  await expect(saved(page).getByText(reference)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mission planner' })).toBeVisible();
  await expect(saved(page).getByText(reference)).toHaveCount(0);
});
