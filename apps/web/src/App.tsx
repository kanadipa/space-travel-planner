import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, api, type MissionInput } from './api';
import { distance, isoDate, longDate, percent, years } from './format';
import { Controls } from './components/Controls';
import { CraftList } from './components/CraftList';
import { SavedMissions } from './components/SavedMissions';
import { TrajectoryDiagram } from './components/TrajectoryDiagram';
import type { CatalogResponse, Evaluation, Failure, Mission, Spacecraft } from './types';
import styles from './App.module.css';

/**
 * The supplied data carries no epoch, and missions run for years, so the planner
 * needs a clock to sit on. See ASSUMPTIONS.md.
 */
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
  const [evaluating, setEvaluating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveFailures, setSaveFailures] = useState<Failure[] | null>(null);
  const [savedReference, setSavedReference] = useState<string | null>(null);

  const maxCapacity = useMemo(
    () => (fleet.length ? Math.max(...fleet.map((c) => c.capacity)) : 30),
    [fleet],
  );

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
   * The evaluation is cheap, but a burst of in-flight requests can resolve out of
   * order and show a stale answer.
   */
  useEffect(() => {
    if (selectedIds.length === 0) {
      setEvaluations([]);
      return;
    }

    let cancelled = false;
    setEvaluating(true);

    const timer = setTimeout(() => {
      api
        .evaluate({ passengerCount, destinationIds: selectedIds, departureDate })
        .then((response) => {
          if (cancelled) return;
          setEvaluations(response.evaluations);
        })
        .catch(() => {
          if (!cancelled) setEvaluations([]);
        })
        .finally(() => {
          if (!cancelled) setEvaluating(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedIds, passengerCount, departureDate]);

  /** A chosen craft that stops being feasible must not stay selected. */
  useEffect(() => {
    if (!craftId) return;
    const still = evaluations.find((e) => e.spacecraftId === craftId && e.feasible);
    if (!still) setCraftId(null);
  }, [evaluations, craftId]);

  const selected = evaluations.find((e) => e.spacecraftId === craftId) ?? null;
  const preview = selected ?? evaluations.find((e) => e.feasible) ?? evaluations[0] ?? null;

  const toggleDestination = useCallback((id: string) => {
    setSavedReference(null);
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }, []);

  const reset = () => {
    setEditingId(null);
    setSelectedIds([]);
    setCraftId(null);
    setPassengerCount(4);
    setDepartureDate(defaultDepartureDate());
    setSaveFailures(null);
    setSavedReference(null);
  };

  async function save() {
    if (!craftId) return;

    const payload: MissionInput = {
      spacecraftId: craftId,
      passengerCount,
      destinationIds: selectedIds,
      departureDate: new Date(departureDate).toISOString(),
    };

    try {
      setSaveFailures(null);
      const mission = editingId
        ? await api.updateMission(editingId, payload)
        : await api.createMission(payload);

      setMissions(await api.listMissions());
      setEditingId(mission.id);
      setSavedReference(mission.reference);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const body = error.body as { failures?: Failure[] };
        setSaveFailures(body.failures ?? []);
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
    setSavedReference(mission.reference);
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
            Departing {catalog.departure.name} · orbits halted, 40-year window
          </p>
        </div>
        {editingId && (
          <button type="button" className={styles.ghost} onClick={reset}>
            New mission
          </button>
        )}
      </header>

      <Controls
        destinations={catalog.destinations}
        excluded={catalog.excluded}
        selectedIds={selectedIds}
        passengerCount={passengerCount}
        departureDate={departureDate}
        maxCapacity={maxCapacity}
        onToggleDestination={toggleDestination}
        onPassengerCount={(value) => {
          setSavedReference(null);
          setPassengerCount(value);
        }}
        onDepartureDate={(value) => {
          setSavedReference(null);
          setDepartureDate(value);
        }}
      />

      <TrajectoryDiagram
        bodies={bodies}
        departure={catalog.departure}
        selectedIds={selectedIds}
        legs={preview?.itinerary.legs ?? []}
      />

      {selectedIds.length === 0 ? (
        <p className={styles.prompt}>Choose one or more destinations to plan a trajectory.</p>
      ) : (
        <>
          <div className={styles.metrics}>
            <Metric label="Total distance" value={distance(preview?.itinerary.totalDistanceKm ?? 0)} />
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
            selectedId={craftId}
            onSelect={(id) => {
              setSavedReference(null);
              setCraftId(id);
            }}
          />

          <section className={styles.savePanel}>
            <div>
              {savedReference ? (
                <p className={styles.saved}>
                  Saved as <strong>{savedReference}</strong>
                  {editingId ? ' — further edits update this plan.' : '.'}
                </p>
              ) : (
                <p className={styles.hint}>
                  {craftId
                    ? 'The server revalidates the whole mission before it is stored.'
                    : 'Choose a feasible spacecraft to save this mission.'}
                </p>
              )}

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
              disabled={!craftId || evaluating}
            >
              {editingId ? 'Update mission' : 'Save mission'}
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
  const end = new Date(start.getTime() + durationYears * 365.25 * 24 * 3_600_000);
  return longDate(end);
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
      {hint && <span className={styles.metricHint}>{hint}</span>}
    </div>
  );
}
