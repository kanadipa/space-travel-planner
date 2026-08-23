import { useState } from 'react';
import { useRoute } from './router';
import { arrivalAfter, defaultDepartureDate } from './utils/dates';
import { consumption, distance, duration, isoDate, longDate, percent } from './format';
import { Controls } from './components/Controls';
import { CraftList } from './components/CraftList';
import { Link } from './components/Link';
import { Metric } from './components/Metric';
import { SavePanel } from './components/SavePanel';
import { SavedMissions } from './components/SavedMissions';
import { TrajectoryDiagram } from './components/TrajectoryDiagram';
import { useCatalogue } from './hooks/useCatalogue';
import { useEvaluation } from './hooks/useEvaluation';
import { useMissions } from './hooks/useMissions';
import type { Mission } from './interfaces/types';
import styles from './App.module.css';

export function App() {
  const [route, navigate] = useRoute();

  const { catalog, fleet, error: loadError } = useCatalogue();
  const { missions, editing, editingId, saveError, saving, save, remove, open } = useMissions();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [passengerCount, setPassengerCount] = useState(4);
  const [departureDate, setDepartureDate] = useState(defaultDepartureDate);
  const [craftId, setCraftId] = useState<string | null>(null);

  const { evaluations, busyIds, evaluating } = useEvaluation({
    selectedIds,
    passengerCount,
    departureDate,
    editingId,
  });

  const selected = evaluations.find((e) => e.spacecraftId === craftId && e.feasible) ?? null;
  const preview = selected ?? evaluations.find((e) => e.feasible) ?? evaluations[0] ?? null;

  const selectedIsBusy = selected !== null && busyIds.includes(selected.spacecraftId);

  const unsaved =
    editing !== null &&
    (editing.spacecraftId !== craftId ||
      editing.passengerCount !== passengerCount ||
      isoDate(editing.departureDate) !== departureDate ||
      editing.destinationIds.join() !== selectedIds.join());

  const maxCapacity = fleet.length ? Math.max(...fleet.map((craft) => craft.capacity)) : 30;

  const onPlanner = route === '/';

  function toggleDestination(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  }

  function clearInputs() {
    setSelectedIds([]);
    setCraftId(null);
    setPassengerCount(4);
    setDepartureDate(defaultDepartureDate());
  }

  /** Clears the plan and shows the planner, wherever it was pressed from. */
  function startNewMission() {
    open(null);
    clearInputs();
    navigate('/');
  }

  /** Deleting the open plan leaves the planner with nothing to amend. */
  async function removeMission(id: string) {
    const wasOpen = editingId === id;
    await remove(id);
    if (wasOpen) clearInputs();
  }

  function saveCurrent() {
    if (!selected) return;

    return save({
      spacecraftId: selected.spacecraftId,
      passengerCount,
      destinationIds: selectedIds,
      departureDate: new Date(departureDate).toISOString(),
    });
  }

  /** Opening a plan means working on it, so this lands on the planner. */
  function load(mission: Mission) {
    navigate('/');
    open(mission.id);
    setSelectedIds(mission.destinationIds);
    setPassengerCount(mission.passengerCount);
    setDepartureDate(isoDate(mission.departureDate));
    setCraftId(mission.spacecraftId);
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
        <div className={styles.titleRow}>
          <h1>Mission planner</h1>

          <div className={styles.actions}>
            {onPlanner ? (
              <Link to="/missions" navigate={navigate} className={styles.ghost}>
                Missions{missions.length > 0 && ` (${missions.length})`}
              </Link>
            ) : (
              <Link to="/" navigate={navigate} className={styles.ghost}>
                Planner
              </Link>
            )}
            <button
              type="button"
              className={styles.ghost}
              onClick={startNewMission}
              disabled={onPlanner && editingId === null && selectedIds.length === 0}
            >
              New mission
            </button>
          </div>
        </div>

        {onPlanner && (
          <>
            <p className={styles.sub}>
              Departing {catalog.departure.name} · orbits halted, 42-year window
            </p>
            <span className={styles.sub}>
              Bodies are evenly spaced in orbital order, not to scale.
            </span>
          </>
        )}

        {onPlanner && editing && (
          <div className={styles.editing}>
            <span className={styles.editingLabel}>
              editing <strong>{editing.reference}</strong>
            </span>
            {unsaved && <em className={styles.unsaved}>unsaved changes</em>}
          </div>
        )}
      </header>

      {!onPlanner ? (
        <SavedMissions
          missions={missions}
          activeId={editingId}
          onLoad={load}
          onDelete={removeMission}
        />
      ) : (
        <>
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
                  label="Duration"
                  value={preview ? duration(preview.durationYears) : '—'}
                  hint={
                    preview
                      ? `arrives ${longDate(arrivalAfter(departureDate, preview.durationYears))}`
                      : ''
                  }
                />
                <Metric
                  label="Consumption rate"
                  value={consumption(preview?.consumptionRate ?? 1)}
                  hint={`range units per km · ${passengerCount} aboard`}
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

              <SavePanel
                hasCraft={selected !== null}
                craftIsBusy={selectedIsBusy}
                amending={editing !== null}
                busy={evaluating || saving}
                error={saveError}
                onSave={saveCurrent}
              />
            </>
          )}
        </>
      )}
    </main>
  );
}
