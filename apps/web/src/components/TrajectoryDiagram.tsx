import type { Leg, Planet } from '../types';
import { distance, temperature } from '../format';
import { fillOf } from '../planets';
import styles from './TrajectoryDiagram.module.css';

interface Props {
  bodies: Planet[];
  departure: Planet;
  selectedIds: string[];
  legs: Leg[];
  onToggleDestination: (id: string) => void;
}

/** What the button announces and what a hover reveals: the reason to pick it. */
function describe(body: Planet, isSelected: boolean): string {
  const parts = [temperature(body.averageTemperatureC)];
  if (body.weatherPatterns) parts.push(body.weatherPatterns);
  if (body.potentiallyHabitable) parts.push('potentially habitable');
  return `${body.name} — ${parts.join(', ')}${isSelected ? '. A stop on this route' : ''}`;
}

/**
 * Evenly spaced rather than to scale: the distances span 58 million to 4.5
 * billion km, so any true scale puts the four inner planets on top of each other.
 *
 * The diagram is the destination control. There is no separate list of planets to
 * keep in step with it, and no way for the two to disagree.
 *
 * Laid out in HTML rather than as one drawing, so the names stay real text at a
 * real size instead of scaling with a viewBox. Only the detour arcs are SVG,
 * where a dashed half-circle can be struck exactly.
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

  const onRouteIndexes = bodies
    .map((body, index) => (visited.has(body.id) ? index : -1))
    .filter((index) => index >= 0);
  const first = Math.min(...onRouteIndexes);
  const last = Math.max(...onRouteIndexes);

  return (
    <figure className={styles.figure}>
      <div className={styles.scroller}>
        <div className={styles.chart}>
          <div className={styles.axis} />

          {onRouteIndexes.length > 0 && (
            <div
              className={styles.route}
              style={{
                left: `${centre(first)}%`,
                width: `${centre(last) - centre(first)}%`,
              }}
            />
          )}

          <div className={styles.row}>
            {bodies.map((body) => {
              const dot = 12 + (Math.sqrt(body.diameterKm) / Math.sqrt(maxDiameter)) * 22;
              const isDeparture = body.id === departure.id;
              const isSelected = selectedIds.includes(body.id);
              const isPassed = passed.has(body.id) && !isSelected && !isDeparture;
              const isOnRoute = visited.has(body.id);

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
                      style={{
                        width: dot,
                        height: dot,
                        background: fillOf(body.id),
                      }}
                    />
                  </span>
                  <span className={styles.labels}>
                    <span className={isOnRoute || isDeparture ? styles.nameOn : styles.name}>
                      {body.name}
                    </span>
                    {/* Names the state in words as well as in colour, so the route
                      survives greyscale and reads without the legend. */}
                    <span className={styles.tag}>
                      {isDeparture ? 'depart' : isSelected ? 'stop' : ''}
                    </span>
                  </span>
                </>
              );

              /* Earth is where the mission leaves from, so it is drawn but never offered. */
              return isDeparture ? (
                <div key={body.id} className={styles.home} title={describe(body, false)}>
                  {glyph}
                </div>
              ) : (
                <button
                  key={body.id}
                  type="button"
                  className={styles.planet}
                  aria-pressed={isSelected}
                  aria-label={describe(body, isSelected)}
                  title={describe(body, isSelected)}
                  onClick={() => onToggleDestination(body.id)}
                >
                  {glyph}
                </button>
              );
            })}
          </div>

          {bodies.map((body, index) =>
            passed.has(body.id) && !selectedIds.includes(body.id) && body.id !== departure.id ? (
              <svg
                key={body.id}
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

      {/* Nothing to key or total until a route exists, and an empty caption would
          still hold its space. */}
      {legs.length > 0 && (
        <figcaption className={styles.caption}>
          <span>
            <i className={styles.keyRoute} /> route
          </span>
          {passed.size > 0 && (
            <span>
              <i className={styles.keyDetour} /> detour around a body in the path
            </span>
          )}
          <span className={styles.note}>
            Total {distance(legs.reduce((sum, leg) => sum + leg.distanceKm, 0))}.
          </span>
        </figcaption>
      )}
    </figure>
  );
}
