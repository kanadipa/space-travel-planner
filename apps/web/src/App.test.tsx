import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { installFakeApi, nothingFeasible, savedMission } from './testing/fake-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The debounce in App is 200ms, so evaluation assertions wait rather than assume.
 *
 * Waits for a craft row rather than the section header: the header renders as
 * "0 of 0" the moment a destination is picked, which would let an assertion run
 * before the response has landed.
 */
const waitForEvaluation = () =>
  waitFor(() => expect(screen.getByText('Serenity XL')).toBeInTheDocument(), {
    timeout: 3000,
  });

const chooseMars = async (user: ReturnType<typeof userEvent.setup>) => {
  await waitFor(() => expect(screen.getByRole('button', { name: /^Mars/ })).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: /^Mars/ }));
  await waitForEvaluation();
};

describe('planner screen', () => {
  it('loads the catalogue and offers the destinations', async () => {
    installFakeApi();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Mission planner')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /^Mars/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Venus/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Neptune/ })).toBeInTheDocument();
  });

  it('explains why the Sun is not offered instead of hiding it', async () => {
    installFakeApi();
    render(<App />);

    await waitFor(() => expect(screen.getByText(/Not offered/)).toBeInTheDocument());

    expect(screen.getByText(/5505 °C/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Sun/ })).not.toBeInTheDocument();
  });

  it('asks for a destination before it shows a plan', async () => {
    installFakeApi();
    render(<App />);

    await waitFor(() =>
      expect(screen.getByText(/Choose one or more destinations/i)).toBeInTheDocument(),
    );
  });

  it('evaluates the fleet once a destination is chosen', async () => {
    const user = userEvent.setup();
    installFakeApi();
    render(<App />);

    await chooseMars(user);

    expect(screen.getByText('Serenity XL')).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 can fly this route/i)).toBeInTheDocument();
  });

  /**
   * The product decision from the README: an excluded craft stays visible with
   * its reasons, because knowing why is the point.
   */
  it('keeps excluded craft visible with their reasons', async () => {
    const user = userEvent.setup();
    installFakeApi();
    render(<App />);

    await chooseMars(user);

    expect(screen.getByText('Galactica Scout')).toBeInTheDocument();
    expect(screen.getByText(/Carries 3, 4 booked/)).toBeInTheDocument();

    expect(screen.getByText('Millennial Hopper')).toBeInTheDocument();
    expect(screen.getByText(/above the 150 °C ceiling/)).toBeInTheDocument();
  });

  it('does not let an excluded craft be selected', async () => {
    const user = userEvent.setup();
    installFakeApi();
    render(<App />);

    await chooseMars(user);

    const excluded = screen.getByRole('button', { name: /Galactica Scout/ });
    expect(excluded).toBeDisabled();
  });

  it('says so plainly when nothing in the fleet can fly the route', async () => {
    const user = userEvent.setup();
    installFakeApi({ evaluation: nothingFeasible });
    render(<App />);

    await chooseMars(user);

    expect(screen.getByText(/Nothing in the fleet can fly this route/i)).toBeInTheDocument();
    expect(screen.getByText(/0 of 3 can fly this route/i)).toBeInTheDocument();
  });

  it('requires a feasible craft before the mission can be saved', async () => {
    const user = userEvent.setup();
    installFakeApi();
    render(<App />);

    await chooseMars(user);

    expect(screen.getByRole('button', { name: /Save mission/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Serenity XL/ }));

    expect(screen.getByRole('button', { name: /Save mission/i })).toBeEnabled();
  });

  /**
   * The contract the API depends on: the client asserts inputs only. If this
   * ever sends a distance or a duration, the server's recomputation stops being
   * the single source of truth.
   */
  it('sends only inputs when saving, never computed figures', async () => {
    const user = userEvent.setup();
    const { requests } = installFakeApi();
    render(<App />);

    await chooseMars(user);
    await user.click(screen.getByRole('button', { name: /Serenity XL/ }));
    await user.click(screen.getByRole('button', { name: /Save mission/i }));

    await waitFor(() => expect(requests.some((r) => r.method === 'POST' && r.path === '/missions')).toBe(true));

    const save = requests.find((r) => r.method === 'POST' && r.path === '/missions');
    expect(Object.keys(save!.body as object).sort()).toEqual([
      'departureDate',
      'destinationIds',
      'passengerCount',
      'spacecraftId',
    ]);
  });

  it('confirms the reference after saving and lists the mission', async () => {
    const user = userEvent.setup();
    installFakeApi();
    render(<App />);

    await chooseMars(user);
    await user.click(screen.getByRole('button', { name: /Serenity XL/ }));
    await user.click(screen.getByRole('button', { name: /Save mission/i }));

    await waitFor(() => expect(screen.getAllByText(/8WDKQ/).length).toBeGreaterThan(0));
  });

  it('surfaces the server failures when a save is refused with 422', async () => {
    const user = userEvent.setup();
    installFakeApi({
      createRejects: {
        status: 422,
        body: {
          message: 'This mission cannot be flown as configured.',
          failures: [
            {
              code: 'OUT_OF_RANGE',
              actionable: true,
              message: 'Short by 9,386,880,990 km.',
              detail: {},
            },
          ],
        },
      },
    });
    render(<App />);

    await chooseMars(user);
    await user.click(screen.getByRole('button', { name: /Serenity XL/ }));
    await user.click(screen.getByRole('button', { name: /Save mission/i }));

    await waitFor(() =>
      expect(screen.getByText(/Short by 9,386,880,990 km/)).toBeInTheDocument(),
    );
  });

  it('loads a saved mission back into the planner', async () => {
    const user = userEvent.setup();
    installFakeApi({ missions: [savedMission] });
    render(<App />);

    await waitFor(() => expect(screen.getByText(savedMission.name)).toBeInTheDocument());

    const saved = screen.getByText(savedMission.name).closest('button');
    await user.click(saved!);

    await waitForEvaluation();

    expect(screen.getByRole('button', { name: /^Mars/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('re-evaluates when the passenger count changes', async () => {
    const user = userEvent.setup();
    const { requests } = installFakeApi();
    render(<App />);

    await chooseMars(user);

    const before = requests.filter((r) => r.path === '/evaluations').length;

    fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } });

    await waitFor(() =>
      expect(requests.filter((r) => r.path === '/evaluations').length).toBeGreaterThan(before),
    );

    const latest = requests.filter((r) => r.path === '/evaluations').at(-1);
    expect((latest!.body as { passengerCount: number }).passengerCount).toBe(8);
  });

  it('reports a dead API rather than rendering an empty screen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('connection refused'))),
    );
    render(<App />);

    await waitFor(() => expect(screen.getByText(/Could not reach the API/i)).toBeInTheDocument());
  });

  it('removes a saved mission', async () => {
    const user = userEvent.setup();
    installFakeApi({ missions: [savedMission] });
    render(<App />);

    await waitFor(() => expect(screen.getByText(savedMission.name)).toBeInTheDocument());

    const row = screen.getByText(savedMission.name).closest('li');
    await user.click(within(row!).getByRole('button', { name: /Delete mission/i }));

    await waitFor(() => expect(screen.queryByText(savedMission.name)).not.toBeInTheDocument());
  });
});
