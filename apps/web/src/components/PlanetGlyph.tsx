import type { ReactElement } from 'react';
import { appearanceOf, type Appearance } from '../planets';
import type { Planet } from '../types';

interface Props {
  body: Planet;
  cx: number;
  cy: number;
  r: number;
  /** Dimmed when the body is not on the current route. */
  muted?: boolean;
}

/** Markings, clipped to the disc so nothing spills over the outline. */
function surface(look: Appearance, r: number): ReactElement | null {
  const d = look.detail;
  const w = Math.max(1.6, r * 0.22);

  switch (look.surface) {
    case 'craters':
      return (
        <>
          <circle cx={-r * 0.3} cy={-r * 0.25} r={r * 0.22} fill={d} />
          <circle cx={r * 0.3} cy={r * 0.3} r={r * 0.16} fill={d} />
        </>
      );
    case 'swirl':
      return (
        <>
          <path d={`M ${-r * 0.7} ${-r * 0.3} h ${r * 1.4}`} stroke={d} strokeWidth={w} strokeLinecap="round" />
          <path d={`M ${-r * 0.55} ${r * 0.35} h ${r * 1.0}`} stroke={d} strokeWidth={w} strokeLinecap="round" />
        </>
      );
    case 'continents':
      return (
        <path
          d={`M ${-r * 0.5} ${-r * 0.4} q ${r * 0.35} ${-r * 0.25} ${r * 0.6} ${r * 0.1}
              q ${-r * 0.15} ${r * 0.4} ${-r * 0.6} ${r * 0.3} z
              M ${r * 0.05} ${r * 0.45} q ${r * 0.45} ${-r * 0.2} ${r * 0.6} ${r * 0.15}
              q ${-r * 0.3} ${r * 0.25} ${-r * 0.65} ${r * 0.1} z`}
          fill={d}
        />
      );
    case 'bands':
      return (
        <>
          <path d={`M ${-r} ${-r * 0.45} h ${r * 2}`} stroke={d} strokeWidth={w} strokeLinecap="round" />
          <path d={`M ${-r} 0 h ${r * 2}`} stroke={d} strokeWidth={w} strokeLinecap="round" />
          <path d={`M ${-r} ${r * 0.45} h ${r * 2}`} stroke={d} strokeWidth={w} strokeLinecap="round" />
          <ellipse cx={r * 0.28} cy={r * 0.32} rx={r * 0.26} ry={r * 0.18} fill="#E4573D" />
        </>
      );
    default:
      return null;
  }
}


export function PlanetGlyph({ body, cx, cy, r, muted = false }: Props) {
  const look = appearanceOf(body);
  const clipId = `clip-${body.id}`;

  return (
    <g opacity={muted ? 0.45 : 1} aria-hidden="true">
      {look.surface === 'rings' && (
        <ellipse
          cx={cx}
          cy={cy}
          rx={r * 1.75}
          ry={r * 0.42}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={2.5}
        />
      )}

      <defs>
        <clipPath id={clipId}>
          <circle cx={0} cy={0} r={r} />
        </clipPath>
      </defs>

      <circle cx={cx} cy={cy} r={r} fill={look.fill} stroke="var(--ink)" strokeWidth={2.5} />

      <g transform={`translate(${cx} ${cy})`} clipPath={`url(#${clipId})`} fill="none">
        {surface(look, r)}
      </g>
    </g>
  );
}
