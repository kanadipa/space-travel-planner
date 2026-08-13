import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { feasibleButBusy, installFakeApi, nothingFeasible, savedMission } from './testing/fake-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The debounce in App is 200ms, so evaluation assertions wait rather than assume.
 * Waiting on a craft row and not the section header matters: the header renders
 * "0 of 0" the moment a destination is picked, before the response lands.
 */
const waitForEvaluation = () =>
  waitFor(() => expect(screen.getByText('Serenity XL')).toBeInTheDocument(), { timeout: 3000 });

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

  /* Folded while something in the fleet fits, because the answer comes first —
     but never dropped, and never more than one click away. */
  it('keeps ruled-out craft and their reasons one click away', async () => {
    const user = userEvent.setup();
    installFakeApi();
    render(<App />);

    await chooseMars(user);

    expect(screen.queryByText('Galactica Scout')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ruled out/ }));

    expect(screen.getByText('Galactica Scout')).toBeInTheDocument();
    expect(screen.getByText('Capacity exceeded')).toBeInTheDocument();
    expect(screen.getByText(/Carries 3, 4 booked/)).toBeInTheDocument();

    expect(screen.getByText('Millennial Hopper')).toBeInTheDocument();
    expect(screen.getByText('Above temperature limit')).toBeInTheDocument();
    expect(screen.getByRole('tooltip', { name: /Cannot operate at Venus/ })).toBeInTheDocument();
  });

  it('does not offer a ruled-out craft as a choice', async () => {
    const user = userEvent.setup();
    installFakeApi();
    render(<App />);

    await chooseMars(user);

    expect(screen.getByRole('button', { name: /Serenity XL/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Galactica Scout/ })).not.toBeInTheDocument();
  });

  /* With no answer to show, the reasons are the whole screen, so they are not
     folded away — no click needed to reach them here. */
  it('says so plainly when nothing in the fleet can fly the route', async () => {
    const user = userEvent.setup();
    installFakeApi({ evaluation: nothingFeasible });
    render(<App />);

    await chooseMars(user);

    expect(screen.getByText(/Nothing in the fleet can fly this route/i)).toBeInTheDocument();
    expect(screen.getByText(/0 of 3 can fly this route/i)).toBeInTheDocument();
    expect(screen.getByText('Capacity exceeded')).toBeInTheDocument();
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

  describe('a craft already committed elsewhere', () => {
    it('cannot be saved, and says why', async () => {
      const user = userEvent.setup();
      installFakeApi({ evaluation: feasibleButBusy });
      render(<App />);

      await chooseMars(user);
      await user.click(screen.getByRole('button', { name: /Serenity XL/ }));

      expect(screen.getByRole('button', { name: /Save mission/i })).toBeDisabled();
      expect(screen.getByText(/already committed to another mission/i)).toBeInTheDocument();
    });

    it('is marked in the fleet list rather than hidden from it', async () => {
      const user = userEvent.setup();
      installFakeApi({ evaluation: feasibleButBusy });
      render(<App />);

      await chooseMars(user);

      expect(screen.getByRole('button', { name: /Serenity XL/ })).toBeInTheDocument();
      expect(screen.getByText(/already booked/i)).toBeInTheDocument();
    });

    /* Recommending a craft that cannot be saved would walk the agent into the
       refusal, so the badge moves on. Here nothing else is feasible, so it goes. */
    it('is not the recommendation', async () => {
      const user = userEvent.setup();
      installFakeApi({ evaluation: feasibleButBusy });
      render(<App />);

      await chooseMars(user);

      expect(screen.queryByText(/Recommended/)).not.toBeInTheDocument();
    });

    /* The craft was taken between the evaluation and the save, so the warning
       never appeared and the server is the only thing standing in the way. */
    it('surfaces the 409 when the clash appears only at save time', async () => {
      const user = userEvent.setup();
      installFakeApi({
        createRejects: {
          status: 409,
          body: { message: 'Serenity XL is already committed to 8WDKQ until 2041-08-05.' },
        },
      });
      render(<App />);

      await chooseMars(user);
      await user.click(screen.getByRole('button', { name: /Serenity XL/ }));
      await user.click(screen.getByRole('button', { name: /Save mission/i }));

      await waitFor(() =>
        expect(screen.getByText(/already committed to 8WDKQ/)).toBeInTheDocument(),
      );
    });
  });

  /**
   * The contract the API depends on: the client asserts inputs only. If this ever
   * sends a distance or a duration, the server's recomputation stops being the
   * single source of truth.
   */
  it('sends only inputs when saving, never computed figures', async () => {
    const user = userEvent.setup();
    const { requests } = installFakeApi();
    render(<App />);

    await chooseMars(user);
    await user.click(screen.getByRole('button', { name: /Serenity XL/ }));
    await user.click(screen.getByRole('button', { name: /Save mission/i }));

    await waitFor(() =>
      expect(requests.some((r) => r.method === 'POST' && r.path === '/missions')).toBe(true),
    );

    const save = requests.find((r) => r.method === 'POST' && r.path === '/missions');
    expect(Object.keys(save!.body as object).sort()).toEqual([
      'departureDate',
      'destinationIds',
      'passengerCount',
      'spacecraftId',
    ]);
  });

  it('names the mission being edited in the header once it is saved', async () => {
    const user = userEvent.setup();
    installFakeApi();
    render(<App />);

    await chooseMars(user);
    await user.click(screen.getByRole('button', { name: /Serenity XL/ }));
    await user.click(screen.getByRole('button', { name: /Save mission/i }));

    const banner = await screen.findByText(/editing/i);
    expect(within(banner).getByText('8WDKQ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update mission/i })).toBeInTheDocument();
  });

  it('flags unsaved changes to a mission already saved', async () => {
    const user = userEvent.setup();
    installFakeApi({ missions: [savedMission] });
    render(<App />);

    await waitFor(() => expect(screen.getByText(savedMission.name)).toBeInTheDocument());
    await user.click(screen.getByText(savedMission.name).closest('button')!);
    await waitForEvaluation();

    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /One more passenger/i }));

    expect(await screen.findByText(/unsaved changes/i)).toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByText(/Short by 9,386,880,990 km/)).toBeInTheDocument());
  });

  it('loads a saved mission back into the planner', async () => {
    const user = userEvent.setup();
    installFakeApi({ missions: [savedMission] });
    render(<App />);

    await waitFor(() => expect(screen.getByText(savedMission.name)).toBeInTheDocument());
    await user.click(screen.getByText(savedMission.name).closest('button')!);
    await waitForEvaluation();

    expect(screen.getByRole('button', { name: /^Mars/ })).toHaveAttribute('aria-pressed', 'true');

    // Once in the header banner, once in the saved list.
    expect(screen.getAllByText(savedMission.reference)).toHaveLength(2);
  });

  it('re-evaluates when the passenger count changes', async () => {
    const user = userEvent.setup();
    const { requests } = installFakeApi();
    render(<App />);

    await chooseMars(user);

    const before = requests.filter((r) => r.path === '/evaluations').length;

    await user.click(screen.getByRole('button', { name: /One more passenger/i }));

    await waitFor(() =>
      expect(requests.filter((r) => r.path === '/evaluations').length).toBeGreaterThan(before),
    );

    const latest = requests.filter((r) => r.path === '/evaluations').at(-1);
    expect((latest!.body as { passengerCount: number }).passengerCount).toBe(5);
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
