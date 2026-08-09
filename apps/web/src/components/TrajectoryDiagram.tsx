import type { Leg, Planet } from '../types';
import { distance } from '../format';
import { PlanetGlyph } from './PlanetGlyph';
import styles from './TrajectoryDiagram.module.css';

interface Props {
  bodies: Planet[];
  departure: Planet;
  selectedIds: string[];
  legs: Leg[];
}

const WIDTH = 900;
const HEIGHT = 190;
const AXIS_Y = 96;
const MARGIN = 56;

/**
 * Evenly spaced rather than to scale: the distances span 58 million to 4.5
 * billion km, so any true scale puts the four inner planets on top of each other.
 */
export function TrajectoryDiagram({ bodies, departure, selectedIds, legs }: Props) {
  const maxDiameter = Math.max(...bodies.map((body) => body.diameterKm));
  const gap = (WIDTH - MARGIN * 2) / Math.max(bodies.length - 1, 1);
  const at = (id: string) => MARGIN + bodies.findIndex((body) => body.id === id) * gap;

  const visited = new Set(legs.flatMap((leg) => [leg.fromPlanetId, leg.toPlanetId]));
  const passed = new Set(legs.flatMap((leg) => leg.passedPlanetIds));

  const onRoute = [...visited].map(at);
  const routeStart = onRoute.length ? Math.min(...onRoute) : 0;
  const routeEnd = onRoute.length ? Math.max(...onRoute) : 0;

  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.svg} role="img">
        <title>Trajectory along the planetary axis</title>

        <line x1={MARGIN - 30} y1={AXIS_Y} x2={WIDTH - MARGIN + 30} y2={AXIS_Y} className={styles.axis} />

        {legs.length > 0 && (
          <line x1={routeStart} y1={AXIS_Y} x2={routeEnd} y2={AXIS_Y} className={styles.route} />
        )}

        {bodies.map((body) => {
          const cx = at(body.id);
          const r = 8 + (Math.sqrt(body.diameterKm) / Math.sqrt(maxDiameter)) * 14;
          const isDeparture = body.id === departure.id;
          const isSelected = selectedIds.includes(body.id);
          const isPassed = passed.has(body.id) && !isSelected && !isDeparture;
          const isOnRoute = visited.has(body.id) || isPassed;

          return (
            <g key={body.id}>
              {isPassed && (
                <path
                  d={`M ${cx - r - 4} ${AXIS_Y} A ${r + 4} ${r + 4} 0 0 1 ${cx + r + 4} ${AXIS_Y}`}
                  className={styles.detour}
                />
              )}

              <PlanetGlyph body={body} cx={cx} cy={AXIS_Y} r={r} muted={!isOnRoute} />

              <text
                x={cx}
                y={AXIS_Y + r + 24}
                className={isOnRoute || isDeparture ? styles.labelOn : styles.label}
              >
                {body.name}
              </text>

              {(isSelected || isDeparture) && (
                <text x={cx} y={AXIS_Y + r + 38} className={styles.tag}>
                  {isDeparture ? 'depart' : 'stop'}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <figcaption className={styles.caption}>
        {legs.length > 0 && (
          <span>
            <i className={styles.keyRoute} /> route
          </span>
        )}
        {passed.size > 0 && (
          <span>
            <i className={styles.keyDetour} /> detour around a body in the path
          </span>
        )}
        <span className={styles.note}>
          Bodies are evenly spaced in orbital order, not to scale.
          {legs.length > 0 &&
            ` Total ${distance(legs.reduce((sum, leg) => sum + leg.distanceKm, 0))}.`}
        </span>
      </figcaption>
    </figure>
  );
}
