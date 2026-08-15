import { useEffect, useState } from 'react';
import { ApiError, api, type MissionInput } from './api';
import { distance, isoDate, longDate, percent, years } from './format';
import { Controls } from './components/Controls';
import { CraftList } from './components/CraftList';
import { SavedMissions } from './components/SavedMissions';
import { TrajectoryDiagram } from './components/TrajectoryDiagram';
import type { CatalogResponse, Evaluation, Failure, Mission, Spacecraft } from './types';
import styles from './App.module.css';

/** The supplied data carries no epoch and missions run for years. */
function defaultDepartureDate(): string {
  const now = new Date();
  return isoDate(new Date(Date.UTC(2041, now.getUTCMonth(), now.getUTCDate())));
}

export function App() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [fleet, setFleet] = useState<Spacecraft[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [passengerCount, setPassengerCount] = useState(4);
  const [departureDate, setDepartureDate] = useState(defaultDepartureDate);
  const [craftId, setCraftId] = useState<string | null>(null);

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveFailures, setSaveFailures] = useState<Failure[] | null>(null);
  /** The server's 409 message. Separate from `saveFailures`, whose codes are physics. */
  const [saveConflict, setSaveConflict] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.planets(), api.spacecraft(), api.listMissions()])
      .then(([planets, spacecraft, saved]) => {
        setCatalog(planets);
        setFleet(spacecraft);
        setMissions(saved);
      })
      .catch(() => setLoadError('Could not reach the API. Is it running on port 3000?'));
  }, []);

  /**
   * Debounced so dragging the passenger slider does not fire a request per frame.
   * A response is dropped if its inputs are already stale, because a burst of
   * requests can resolve out of order and show an answer to an older question.
   */
  useEffect(() => {
    if (selectedIds.length === 0) {
      setEvaluations([]);
      setBusyIds([]);
      return;
    }

    let cancelled = false;
    setEvaluating(true);

    const timer = setTimeout(() => {
      api
        .evaluate({
          passengerCount,
          destinationIds: selectedIds,
          departureDate,
          // Sent while amending, so the plan being edited is not reported as
          // clashing with itself.
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
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedIds, passengerCount, departureDate, editingId]);

  // Derived, not stored: a craft that stops being feasible when the route changes
  // stops being the selection, with no effect needed to clear it.
  const selected = evaluations.find((e) => e.spacecraftId === craftId && e.feasible) ?? null;
  const preview = selected ?? evaluations.find((e) => e.feasible) ?? evaluations[0] ?? null;

  // Blocks the save. Derived like `selected`, so changing the date or the route
  // frees the craft on the next evaluation with nothing to reset.
  const selectedIsBusy = selected !== null && busyIds.includes(selected.spacecraftId);

  const editing = missions.find((mission) => mission.id === editingId) ?? null;
  const unsaved =
    editing !== null &&
    (editing.spacecraftId !== craftId ||
      editing.passengerCount !== passengerCount ||
      isoDate(editing.departureDate) !== departureDate ||
      editing.destinationIds.join() !== selectedIds.join());

  const maxCapacity = fleet.length ? Math.max(...fleet.map((craft) => craft.capacity)) : 30;

  function toggleDestination(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  }

  function reset() {
    setEditingId(null);
    setSelectedIds([]);
    setCraftId(null);
    setPassengerCount(4);
    setDepartureDate(defaultDepartureDate());
    setSaveFailures(null);
    setSaveConflict(null);
  }

  async function save() {
    if (!selected) return;

    const payload: MissionInput = {
      spacecraftId: selected.spacecraftId,
      passengerCount,
      destinationIds: selectedIds,
      departureDate: new Date(departureDate).toISOString(),
    };

    try {
      setSaveFailures(null);
      setSaveConflict(null);
      const mission = editingId
        ? await api.updateMission(editingId, payload)
        : await api.createMission(payload);

      setMissions(await api.listMissions());
      setEditingId(mission.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const body = error.body as { failures?: Failure[] };
        setSaveFailures(body.failures ?? []);
      } else if (error instanceof ApiError && error.status === 409) {
        // The craft was taken between the last evaluation and this save, so the
        // warning never had a chance to appear. Re-evaluating would race the
        // debounce; the server's message already names the mission in the way.
        const body = error.body as { message?: string };
        setSaveConflict(body.message ?? 'That spacecraft is already committed over these dates.');
      } else {
        setSaveFailures([
          { code: 'OUT_OF_RANGE', actionable: false, message: 'Could not save.', detail: {} },
        ]);
      }
    }
  }

  function load(mission: Mission) {
    setEditingId(mission.id);
    setSelectedIds(mission.destinationIds);
    setPassengerCount(mission.passengerCount);
    setDepartureDate(isoDate(mission.departureDate));
    setCraftId(mission.spacecraftId);
    setSaveFailures(null);
    setSaveConflict(null);
  }

  async function remove(id: string) {
    await api.deleteMission(id);
    setMissions(await api.listMissions());
    if (editingId === id) reset();
  }

  if (loadError) {
    return (
      <main className={styles.shell}>
        <p className={styles.fatal}>{loadError}</p>
      </main>
    );
  }

  if (!catalog) {
    return (
      <main className={styles.shell}>
        <p className={styles.loading}>Loading catalogue…</p>
      </main>
    );
  }

  const bodies = [catalog.departure, ...catalog.destinations].sort(
    (a, b) => a.distanceFromSunKm - b.distanceFromSunKm,
  );

  return (
    <main className={styles.shell}>
      <header className={styles.masthead}>
        <div>
          <h1>Mission planner</h1>
          <p className={styles.sub}>
            Departing {catalog.departure.name} · orbits halted, 42-year window
          </p>
          <span className={styles.sub}>
          Pick a planet to add or drop a stop. Bodies are evenly spaced in orbital order, not to
          scale.
         </span>
        </div>

        

        {editing && (
          <div className={styles.editing}>
            <span className={styles.editingLabel}>
              editing <strong>{editing.reference}</strong>
              {unsaved && <em className={styles.unsaved}>unsaved changes</em>}
            </span>
            <button type="button" className={styles.ghost} onClick={reset}>
              New mission
            </button>
          </div>
        )}
      </header>

      <TrajectoryDiagram
        bodies={bodies}
        departure={catalog.departure}
        selectedIds={selectedIds}
        legs={preview?.itinerary.legs ?? []}
        onToggleDestination={toggleDestination}
      />

      <Controls
        excluded={catalog.excluded}
        passengerCount={passengerCount}
        departureDate={departureDate}
        maxCapacity={maxCapacity}
        onPassengerCount={setPassengerCount}
        onDepartureDate={setDepartureDate}
      />

      {selectedIds.length === 0 ? (
        <p className={styles.prompt}>Choose one or more destinations to plan a trajectory.</p>
      ) : (
        <>
          <div className={styles.metrics}>
            <Metric
              label="Total distance"
              value={distance(preview?.itinerary.totalDistanceKm ?? 0)}
            />
            <Metric
              label="Consumption rate"
              value={(preview?.consumptionRate ?? 1).toFixed(3)}
              hint={`${passengerCount} aboard`}
            />
            <Metric
              label="Duration"
              value={preview ? years(preview.durationYears) : '—'}
              hint={preview ? `arrives ${arrivalOf(departureDate, preview.durationYears)}` : ''}
            />
            <Metric
              label="Range used"
              value={preview ? percent(preview.rangeUtilisation) : '—'}
              hint={preview ? distance(preview.rangeConsumedKm) : ''}
            />
          </div>

          <CraftList
            evaluations={evaluations}
            fleet={fleet}
            busyIds={busyIds}
            selectedId={selected?.spacecraftId ?? null}
            onSelect={setCraftId}
          />

          <section className={styles.savePanel}>
            <div>
              <p className={styles.hint}>
                {selected
                  ? 'The server revalidates the whole mission before it is stored.'
                  : 'Choose a feasible spacecraft to save this mission.'}
              </p>

              {selectedIsBusy && (
                <p className={styles.warning}>
                  This spacecraft is already committed to another mission over these dates. Choose
                  another craft, or move the departure date.
                </p>
              )}

              {saveConflict && <p className={styles.warning}>{saveConflict}</p>}

              {saveFailures && saveFailures.length > 0 && (
                <ul className={styles.saveErrors}>
                  {saveFailures.map((failure, index) => (
                    <li key={index}>{failure.message}</li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              className={styles.primary}
              onClick={save}
              disabled={!selected || selectedIsBusy || evaluating}
            >
              {editing ? 'Update mission' : 'Save mission'}
            </button>
          </section>
        </>
      )}

      <SavedMissions missions={missions} activeId={editingId} onLoad={load} onDelete={remove} />
    </main>
  );
}

function arrivalOf(departure: string, durationYears: number): string {
  const start = new Date(departure);
  return longDate(new Date(start.getTime() + durationYears * 365.25 * 24 * 3_600_000));
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={styles.metric} style={{ background: "var(--surface)" }}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricHint}>{hint}</span>
    </div>
  );
}
