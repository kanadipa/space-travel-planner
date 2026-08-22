import { radiation, temperature } from '../format';
import type { Stage } from '../interfaces/trajectory';
import type { Leg } from '../interfaces/types';

/**
 * The bodies of a route in the order they are reached, each one once.
 *
 * Flight order, not orbital order. The diagram is drawn sorted by distance from
 * the sun, and telling the story in that order put an inner destination ahead of
 * the planet the mission departs from — "A stop on Venus… Home is Earth".
 */
export function routeOrder(legs: readonly Leg[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();

  const add = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    order.push(id);
  };

  if (legs.length > 0) add(legs[0]!.fromPlanetId);

  for (const leg of legs) {
    // Flown around on the way to the far end, so they come first.
    leg.passedPlanetIds.forEach(add);
    add(leg.toPlanetId);
  }

  return order;
}

/** "Venus, Mars and Saturn" — an Oxford-comma-free list in reading order. */
export function listOf(names: string[]): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** One sentence per body on the route: weather, temperature, radiation and moons. */
export function sentenceFor({ body, isOnRoute, isDeparture }: Stage): string {
  if (!isOnRoute) return `Passing around ${body.name}.`;

  // Only the prose is lowercased. Lowercasing the joined sentence turned °C into
  // °c and mSv into msv.
  const parts = [];
  if (body.potentiallyHabitable) parts.push('potentially habitable');
  if (body.weatherPatterns) parts.push(body.weatherPatterns.toLowerCase());
  if (body.averageTemperatureC != null) parts.push(temperature(body.averageTemperatureC));
  if (body.radiationLevelsMsv != null)
    parts.push(`${radiation(body.radiationLevelsMsv)} radiation`);

  const moons = body.moons?.length ? ` Its moons: ${listOf(body.moons)}.` : ' It has no moons.';
  const opener = isDeparture ? `Home is ${body.name}` : `A stop on ${body.name}`;

  return `${opener}: ${parts.join(', ')}.${moons}`;
}

/** The word under a body, if it has earned one. */
export function tagFor({ isDeparture, isSelected }: Stage): string {
  if (isDeparture) return 'depart';
  return isSelected ? 'stop' : '';
}

/** What a planet button is called. Leads with the body so it sorts and reads by planet. */
export function nameFor({ body, isSelected, isPassed }: Stage): string {
  if (isSelected) return `${body.name} — a stop on this route`;
  if (isPassed) return `${body.name} — passed on the way`;
  return `${body.name} — not on this route`;
}
