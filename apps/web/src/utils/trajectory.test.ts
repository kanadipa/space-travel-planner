import { describe, expect, it } from 'vitest';
import type { Stage } from '../interfaces/trajectory';
import type { Leg, Planet } from '../interfaces/types';
import { listOf, nameFor, routeOrder, sentenceFor, tagFor } from './trajectory';

const leg = (from: string, to: string, passed: string[] = []): Leg => ({
  fromPlanetId: from,
  toPlanetId: to,
  surfaceDistanceKm: 1,
  passedPlanetIds: passed,
  detourKm: 0,
  distanceKm: 1,
});

const planet = (over: Partial<Planet> = {}): Planet => ({
  id: 'mars',
  name: 'Mars',
  type: 'Planet',
  distanceFromSunKm: 227_900_000,
  diameterKm: 6_779,
  averageTemperatureC: -65,
  potentiallyHabitable: false,
  ...over,
});

const stage = (over: Partial<Stage> = {}): Stage => ({
  body: planet(),
  isDeparture: false,
  isSelected: true,
  isPassed: false,
  isOnRoute: true,
  ...over,
});

describe('routeOrder', () => {
  it('is empty when nothing has been planned', () => {
    expect(routeOrder([])).toEqual([]);
  });

  it('opens with the body the mission departs from', () => {
    expect(routeOrder([leg('earth', 'mars'), leg('mars', 'earth')])[0]).toBe('earth');
  });

  /*
   * The regression this exists for. The diagram is drawn in orbital order, and
   * telling the story that way put an inner destination ahead of home:
   * "A stop on Venus… Home is Earth".
   */
  it('puts home first even when the destination orbits closer to the sun', () => {
    expect(routeOrder([leg('earth', 'venus'), leg('venus', 'earth')])).toEqual(['earth', 'venus']);
  });

  it('names a body flown around before the stop it is on the way to', () => {
    const order = routeOrder([
      leg('earth', 'neptune', ['mars', 'jupiter']),
      leg('neptune', 'earth'),
    ]);

    expect(order).toEqual(['earth', 'mars', 'jupiter', 'neptune']);
  });

  it('names each body once, however often the route crosses it', () => {
    const order = routeOrder([
      leg('earth', 'neptune', ['mars']),
      leg('neptune', 'earth', ['mars']),
      leg('earth', 'venus'),
      leg('venus', 'earth'),
    ]);

    expect(order).toEqual(['earth', 'mars', 'neptune', 'venus']);
  });
});

describe('sentenceFor', () => {
  it('opens differently for home and for a stop', () => {
    expect(sentenceFor(stage({ isDeparture: true }))).toMatch(/^Home is Mars:/);
    expect(sentenceFor(stage())).toMatch(/^A stop on Mars:/);
  });

  it('says a body is flown around when it is not a stop', () => {
    expect(sentenceFor(stage({ isOnRoute: false, isPassed: true }))).toBe('Passing around Mars.');
  });

  it('says so rather than trailing off when a body has no moons', () => {
    expect(sentenceFor(stage({ body: planet({ moons: [] }) }))).toContain('It has no moons.');
    expect(sentenceFor(stage({ body: planet({ moons: ['Phobos', 'Deimos'] }) }))).toContain(
      'Its moons: Phobos and Deimos.',
    );
  });

  /* Lowercasing the assembled sentence turned °C into °c and mSv into msv. */
  it('lowercases the prose but not the units', () => {
    const sentence = sentenceFor(
      stage({ body: planet({ weatherPatterns: 'Dust storms', radiationLevelsMsv: 240 }) }),
    );

    expect(sentence).toContain('dust storms');
    expect(sentence).toContain('-65 °C');
    expect(sentence).toContain('240 mSv radiation');
  });

  it('keeps a temperature of exactly zero', () => {
    expect(sentenceFor(stage({ body: planet({ averageTemperatureC: 0 }) }))).toContain('0 °C');
  });
});

describe('listOf, tagFor and nameFor', () => {
  it('joins names the way they are read aloud', () => {
    expect(listOf([])).toBe('');
    expect(listOf(['Mars'])).toBe('Mars');
    expect(listOf(['Venus', 'Mars', 'Saturn'])).toBe('Venus, Mars and Saturn');
  });

  it('tags the departure ahead of a stop, and nothing else at all', () => {
    expect(tagFor(stage({ isDeparture: true }))).toBe('depart');
    expect(tagFor(stage())).toBe('stop');
    expect(tagFor(stage({ isSelected: false }))).toBe('');
  });

  /* The visible name leads, so `getByRole('button', { name: /^Mars/ })` still matches. */
  it('leads the accessible name with the body', () => {
    expect(nameFor(stage())).toMatch(/^Mars/);
    expect(nameFor(stage({ isSelected: false, isPassed: true }))).toMatch(/^Mars/);
    expect(nameFor(stage({ isSelected: false }))).toMatch(/^Mars/);
  });
});
