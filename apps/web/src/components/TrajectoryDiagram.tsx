import type { Leg, Planet } from '../types';
import { distance } from '../format';
import styles from './TrajectoryDiagram.module.css';

interface Props {
  bodies: Planet[];
  departure: Planet;
  selectedIds: string[];
  legs: Leg[];
}

const WIDTH = 900;
const HEIGHT = 190;
const AXIS_Y = 118;
const MARGIN = 46;

/**
 * Positions bodies on a square-root scale.
 *
 * Distances span 58 million to 4.5 billion km. On a linear axis the four inner
 * planets collapse into a single pixel; a square root keeps the ordering honest
 * while leaving them legible. The axis is therefore not to scale, and says so.
 */
function scale(bodies: Planet[]): (km: number) => number {
  const max = Math.max(...bodies.map((b) => b.distanceFromSunKm));
  return (km) => MARGIN + (Math.sqrt(km) / Math.sqrt(max)) * (WIDTH - MARGIN * 2);
}

function radius(body: Planet, maxDiameter: number): number {
  const min = 4;
  const max = 15;
  return min + (Math.sqrt(body.diameterKm) / Math.sqrt(maxDiameter)) * (max - min);
}

/** Width of one character at the 11px monospace the labels are set in. */
const LABEL_CHAR_W = 6.6;
const LABEL_ROW_H = 13;

/**
 * Assigns each label a row so the inner planets stay readable.
 *
 * The square-root scale separates the inner bodies enough to tell the dots
 * apart, but their names are still wider than the gaps between them — on one
 * baseline "Mercury", "Venus" and "Earth" overlap. Labels are placed left to
 * right and drop a row whenever they would run into the last one already
 * placed on that row.
 */
function labelRows(bodies: Planet[], x: (km: number) => number): Map<string, number> {
  const ordered = [...bodies].sort((a, b) => a.distanceFromSunKm - b.distanceFromSunKm);
  const rightEdges: number[] = [];
  const rows = new Map<string, number>();

  for (const body of ordered) {
    const centre = x(body.distanceFromSunKm);
    const half = (body.name.length * LABEL_CHAR_W) / 2;

    let row = 0;
    for (;;) {
      const edge = rightEdges[row];
      if (edge === undefined || centre - half >= edge) break;
      row += 1;
    }

    rows.set(body.id, row);
    rightEdges[row] = centre + half;
  }

  return rows;
}

export function TrajectoryDiagram({ bodies, departure, selectedIds, legs }: Props) {
  const x = scale(bodies);
  const maxDiameter = Math.max(...bodies.map((b) => b.diameterKm));
  const rows = labelRows(bodies, x);

  const visited = new Set(legs.flatMap((leg) => [leg.fromPlanetId, leg.toPlanetId]));
  const passed = new Set(legs.flatMap((leg) => leg.passedPlanetIds));

  const reach = legs.length
    ? Math.max(...legs.flatMap((leg) => [leg.fromPlanetId, leg.toPlanetId]).map((id) => {
        const body = bodies.find((b) => b.id === id);
        return body ? body.distanceFromSunKm : 0;
      }))
    : 0;

  const inwardReach = legs.length
    ? Math.min(...legs.flatMap((leg) => [leg.fromPlanetId, leg.toPlanetId]).map((id) => {
        const body = bodies.find((b) => b.id === id);
        return body ? body.distanceFromSunKm : departure.distanceFromSunKm;
      }))
    : departure.distanceFromSunKm;

  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.svg} role="img">
        <title>Trajectory along the planetary axis</title>

        <line x1={MARGIN - 20} y1={AXIS_Y} x2={WIDTH - 20} y2={AXIS_Y} className={styles.axis} />

        {legs.length > 0 && (
          <line
            x1={x(inwardReach)}
            y1={AXIS_Y}
            x2={x(reach)}
            y2={AXIS_Y}
            className={styles.route}
          />
        )}

        {bodies.map((body) => {
          const cx = x(body.distanceFromSunKm);
          const r = radius(body, maxDiameter);
          const isDeparture = body.id === departure.id;
          const isSelected = selectedIds.includes(body.id);
          const isPassed = passed.has(body.id) && !isSelected && !isDeparture;
          const isOnRoute = visited.has(body.id) || isPassed;

          return (
            <g key={body.id}>
              {isPassed && (
                <path
                  d={`M ${cx - r} ${AXIS_Y} A ${r} ${r} 0 0 1 ${cx + r} ${AXIS_Y}`}
                  className={styles.detour}
                />
              )}
              <circle
                cx={cx}
                cy={AXIS_Y}
                r={r}
                className={
                  isDeparture
                    ? styles.departure
                    : isSelected
                      ? styles.selected
                      : isOnRoute
                        ? styles.passed
                        : styles.idle
                }
              />
              <text
                x={cx}
                y={AXIS_Y + r + 18 + (rows.get(body.id) ?? 0) * LABEL_ROW_H}
                className={isOnRoute || isDeparture ? styles.labelOn : styles.label}
              >
                {body.name}
              </text>
              {(isSelected || isDeparture) && (
                <text x={cx} y={AXIS_Y - r - 10} className={styles.tag}>
                  {isDeparture ? 'depart' : 'stop'}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <figcaption className={styles.caption}>
        <span>
          <i className={styles.keyRoute} /> route
        </span>
        <span>
          <i className={styles.keyDetour} /> detour around a body in the path
        </span>
        <span className={styles.note}>
          Positions use a square-root scale so the inner planets stay legible — not to scale.
          {legs.length > 0 && ` Total ${distance(legs.reduce((s, l) => s + l.distanceKm, 0))}.`}
        </span>
      </figcaption>
    </figure>
  );
}
