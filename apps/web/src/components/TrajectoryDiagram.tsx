import type { Leg, Planet } from '../interfaces/types';
import { distance } from '../format';
import { fillOf } from '../planets';
import type { Stage } from '../interfaces/trajectory';
import { nameFor, routeOrder, sentenceFor, tagFor } from '../utils/trajectory';
import styles from './TrajectoryDiagram.module.css';

interface Props {
  bodies: Planet[];
  departure: Planet;
  selectedIds: string[];
  legs: Leg[];
  onToggleDestination: (id: string) => void;
}

/**
 * The diagram is the destination control. Bodies sit in orbital order rather than
 * to scale, because the real spans would stack the four inner planets.
 */
export function TrajectoryDiagram({
  bodies,
  departure,
  selectedIds,
  legs,
  onToggleDestination,
}: Props) {
  const maxDiameter = Math.max(...bodies.map((body) => body.diameterKm));
  /** Centre of a body's column, as a percentage across the row. */
  const centre = (index: number) => ((index + 0.5) / bodies.length) * 100;

  const visited = new Set(legs.flatMap((leg) => [leg.fromPlanetId, leg.toPlanetId]));
  const passed = new Set(legs.flatMap((leg) => leg.passedPlanetIds));

  const stages: Stage[] = bodies.map((body) => {
    const isDeparture = body.id === departure.id;
    const isSelected = selectedIds.includes(body.id);

    return {
      body,
      isDeparture,
      isSelected,
      isPassed: passed.has(body.id) && !visited.has(body.id),
      isOnRoute: visited.has(body.id),
    };
  });

  const onRouteIndexes = stages.flatMap((stage, index) => (stage.isOnRoute ? [index] : []));
  const first = Math.min(...onRouteIndexes);
  const last = Math.max(...onRouteIndexes);

  const planned = legs.length > 0;
  const totalKm = legs.reduce((sum, leg) => sum + leg.distanceKm, 0);

  const byId = new Map(stages.map((stage) => [stage.body.id, stage]));
  const told = routeOrder(legs).flatMap((id) => byId.get(id) ?? []);

  const story = planned
    ? `${told.map(sentenceFor).join(' ')} ${distance(totalKm)} in all.`
    : selectedIds.length > 0
      ? 'Plotting the trajectory…'
      : 'Pick a planet below to start plotting a journey.';

  return (
    <figure className={styles.figure}>
      <p className={styles.summary}>{story}</p>

      <div className={styles.scroller}>
        <div className={styles.chart}>
          <div className={styles.axis} />

          {onRouteIndexes.length > 0 && (
            <div
              className={styles.route}
              style={{ left: `${centre(first)}%`, width: `${centre(last) - centre(first)}%` }}
            />
          )}

          <div className={styles.row}>
            {stages.map((stage) => {
              const { body, isDeparture, isSelected, isPassed, isOnRoute } = stage;
              const dot = 12 + (Math.sqrt(body.diameterKm) / Math.sqrt(maxDiameter)) * 22;

              const ring = [
                styles.ring,
                isOnRoute || isDeparture ? styles.ringOn : styles.ringOff,
                isSelected ? styles.ringHalo : '',
                isPassed ? styles.ringPassed : '',
              ]
                .filter(Boolean)
                .join(' ');

              const glyph = (
                <>
                  <span className={ring}>
                    <span
                      className={styles.dot}
                      style={{ width: dot, height: dot, background: fillOf(body.id) }}
                    />
                  </span>
                  <span className={styles.labels}>
                    <span className={isOnRoute || isDeparture ? styles.nameOn : styles.name}>
                      {body.name}
                    </span>
                    {/* Held open when empty, so selecting does not shift the row. */}
                    <span className={styles.tag}>{tagFor(stage)}</span>
                  </span>
                </>
              );

              /* Earth is where the mission leaves from, so it is drawn but never offered. */
              return isDeparture ? (
                <div key={body.id} className={styles.home}>
                  {glyph}
                </div>
              ) : (
                <button
                  key={body.id}
                  type="button"
                  className={styles.planet}
                  aria-pressed={isSelected}
                  aria-label={nameFor(stage)}
                  onClick={() => onToggleDestination(body.id)}
                >
                  {glyph}
                </button>
              );
            })}
          </div>

          {stages.map((stage, index) =>
            stage.isPassed ? (
              <svg
                key={stage.body.id}
                className={styles.arc}
                style={{ left: `${centre(index)}%` }}
                viewBox="0 0 68 34"
                aria-hidden="true"
              >
                <path d="M 0 34 A 34 34 0 0 1 68 34" />
              </svg>
            ) : null,
          )}
        </div>
      </div>

      {planned && (
        <figcaption className={styles.caption}>
          <span>
            <i className={styles.keyRoute} /> route
          </span>
          {passed.size > 0 && (
            <span>
              <i className={styles.keyDetour} /> detour around a body in the path
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
