import type { Planet } from './types';

/* Keyed by id, so every part of the interface draws a body the same way. */

export type Surface = 'craters' | 'swirl' | 'continents' | 'bands' | 'rings' | 'plain';

export interface Appearance {
  fill: string;
  /** Markings drawn on top of the fill. Always darker than it. */
  detail: string;
  /** Text colour for a chip filled with `fill`. Same hue family, much darker. */
  ink: string;
  surface: Surface;
}

const NEUTRAL: Appearance = {
  fill: '#DDD6EC',
  detail: '#B6ABD0',
  ink: '#4A4166',
  surface: 'plain',
};

const APPEARANCES: Record<string, Appearance> = {
  sun: { fill: '#FFD34D', detail: '#E8A33D', ink: '#6B4A05', surface: 'swirl' },
  mercury: { fill: '#D6D3D1', detail: '#A8A29E', ink: '#4A4644', surface: 'craters' },
  venus: { fill: '#FFD98A', detail: '#E8A33D', ink: '#7A5B12', surface: 'swirl' },
  earth: { fill: '#7EC8F0', detail: '#5FBF6A', ink: '#1F5B85', surface: 'continents' },
  mars: { fill: '#FF9E7A', detail: '#E0714D', ink: '#8C3B1B', surface: 'craters' },
  jupiter: { fill: '#FFC46B', detail: '#E09B3D', ink: '#7C5216', surface: 'bands' },
  saturn: { fill: '#F2DFAE', detail: '#D6B972', ink: '#7A5C1E', surface: 'rings' },
  uranus: { fill: '#A6E3E8', detail: '#6AB8D8', ink: '#16565C', surface: 'plain' },
  neptune: { fill: '#9FB0F2', detail: '#6B7FD7', ink: '#2E3B87', surface: 'plain' },
};

export function appearanceOf(body: Pick<Planet, 'id'>): Appearance {
  return APPEARANCES[body.id] ?? NEUTRAL;
}
