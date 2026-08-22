import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { Evaluation } from '../interfaces/types';

/**
 * Long enough to absorb a held passenger stepper or a half-typed date.
 *
 * Skipped when the destinations change: a click is one discrete edit, so the
 * wait buys nothing and leaves the old route's verdict under the new planet.
 */
const DEBOUNCE_MS = 200;

interface Inputs {
  selectedIds: string[];
  passengerCount: number;
  departureDate: string;
  /** The plan being amended, so it is not reported as clashing with itself. */
  editingId: string | null;
}

/**
 * Evaluates the fleet server-side, debounced. A superseded response is dropped:
 * a burst can resolve out of order and answer inputs already left behind.
 */
export function useEvaluation({ selectedIds, passengerCount, departureDate, editingId }: Inputs) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  const idle = selectedIds.length === 0;
  /** Destinations the last request went out with, to tell a route change from a tweak. */
  const lastRoute = useRef<string | null>(null);

  useEffect(() => {
    if (idle) return;

    const route = selectedIds.join();
    const routeChanged = route !== lastRoute.current;
    lastRoute.current = route;

    let cancelled = false;
    // Set here rather than in the timer: the flag has to land in the same render
    // as the input change, or the save button stays live through the debounce.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEvaluating(true);

    const timer = setTimeout(
      () => {
        api
          .evaluate({
            passengerCount,
            destinationIds: selectedIds,
            departureDate,
            ...(editingId ? { editingMissionId: editingId } : {}),
          })
          .then((response) => {
            if (cancelled) return;
            setEvaluations(response.evaluations);
            setBusyIds(response.busySpacecraftIds ?? []);
          })
          .catch(() => {
            if (cancelled) return;
            setEvaluations([]);
            setBusyIds([]);
          })
          .finally(() => {
            if (!cancelled) setEvaluating(false);
          });
      },
      routeChanged ? 0 : DEBOUNCE_MS,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [idle, selectedIds, passengerCount, departureDate, editingId]);

  // Emptied on the way out rather than by clearing state in the effect, which
  // would cost a second render to say what the inputs already say.
  if (idle) return { evaluations: NONE, busyIds: NO_IDS, evaluating: false };

  return { evaluations, busyIds, evaluating };
}

const NONE: Evaluation[] = [];
const NO_IDS: string[] = [];
