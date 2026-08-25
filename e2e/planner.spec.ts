import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_URL = 'http://localhost:3000';
// Anchored: without a prefix the code is five bare characters, and an unanchored
// match would find them inside any other run of capitals on the screen.
const REFERENCE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

/**
 * Scoped to the two named regions: a saved mission's summary line also names its
 * spacecraft, so an unscoped `getByRole('button', { name: /Serenity XL/ })`
 * matches craft rows and saved rows alike once anything has been saved.
 */
const fleet = (page: Page) => page.getByRole('region', { name: 'Spacecraft' });
const saved = (page: Page) => page.getByRole('region', { name: 'Saved missions' });

async function clearMissions(request: APIRequestContext): Promise<void> {
  const missions = await (await request.get(`${API_URL}/api/missions`)).json();
  for (const mission of missions) {
    await request.delete(`${API_URL}/api/missions/${mission.id}`);
  }
}

/** The saved list has its own screen, so reaching it is a navigation. */
async function goToMissions(page: Page): Promise<void> {
  await page.getByRole('link', { name: /^Missions/ }).click();
  await expect(page.getByRole('heading', { name: 'Saved missions' })).toBeVisible();
}

/** Plans a route to one body and saves it, returning the allocated reference. */
async function planAndSave(page: Page, body: string): Promise<string> {
  await page.getByRole('button', { name: new RegExp(`^${body}`) }).click();

  // Waits for the debounced evaluation to land rather than assuming a delay.
  await expect(page.getByText(/can fly this route/)).toBeVisible();

  await fleet(page)
    .getByRole('button', { name: /Serenity XL/ })
    .click();
  await page.getByRole('button', { name: 'Save mission' }).click();
  await expect(page.getByRole('button', { name: 'Update mission' })).toBeVisible();

  // Read from the masthead, which names the open plan, rather than from the saved
  // list — that is on the other screen and this stays on the planner. The saved
  // list having moved is what makes the reference unique on this screen.
  const quoted = await page.getByText(REFERENCE).textContent();
  return quoted!.trim();
}

test.beforeEach(async ({ page, request }) => {
  await clearMissions(request);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mission planner' })).toBeVisible();
});

test('saves a planned mission and quotes its reference', async ({ page }) => {
  const reference = await planAndSave(page, 'Mars');

  expect(reference).toMatch(REFERENCE);

  await goToMissions(page);
  await expect(saved(page).getByText(reference)).toBeVisible();
});

test('the saved mission survives a full page reload', async ({ page }) => {
  const reference = await planAndSave(page, 'Mars');

  await page.goto('/missions');
  await expect(page.getByRole('heading', { name: 'Saved missions' })).toBeVisible();
  await expect(saved(page).getByText(reference)).toBeVisible();
});

/**
 * The whole E2E: the booking is in Postgres, the evaluation reads it
 * back, and the button the agent would press is dead.
 */
test('will not double-book a craft that is already committed', async ({ page }) => {
  await planAndSave(page, 'Mars');

  await page.getByRole('button', { name: 'New mission' }).click();
  await page.getByRole('button', { name: /^Mars/ }).click();
  await expect(page.getByText(/can fly this route/)).toBeVisible();

  await expect(fleet(page).getByText(/already booked/)).toBeVisible();

  await fleet(page)
    .getByRole('button', { name: /Serenity XL/ })
    .click();
  await expect(page.getByRole('button', { name: 'Save mission' })).toBeDisabled();
  await expect(page.getByText(/already committed to another mission/i)).toBeVisible();
});

test('loads a saved mission back into the planner', async ({ page }) => {
  const reference = await planAndSave(page, 'Jupiter');
  await page.reload();

  // Start from a different plan, then load the saved one over it.
  await page.getByRole('button', { name: /^Mars/ }).click();
  await expect(page.getByRole('button', { name: /^Mars/ })).toHaveAttribute('aria-pressed', 'true');

  await goToMissions(page);

  // Anchored: the delete control's label also contains the reference.
  await saved(page)
    .getByRole('button', { name: new RegExp(`^${reference}`) })
    .click();

  // Opening a plan takes the agent back to the planner to work on it.
  await expect(page.getByRole('heading', { name: 'Mission planner' })).toBeVisible();

  await expect(page.getByRole('button', { name: /^Jupiter/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: /^Mars/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
