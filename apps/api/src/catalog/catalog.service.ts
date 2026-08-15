import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { parse } from 'yaml';
import {
  DEPARTURE_PLANET_NAME,
  selectableDestinations,
  unreachableBodies,
  type Planet,
  type Spacecraft,
} from '../domain';

/** Raw YAML shapes, before normalisation. */
interface RawPlanet {
  name: string;
  type?: string;
  diameter_km: number;
  distance_from_sun_km: number;
  average_temperature_c: number;
  potentially_habitable: boolean;
  weather_patterns?: string;
  radiation_levels_msv?: number;
  gravity_m_per_s2?: number;
  moons?: string[];
}

interface RawSpacecraft {
  name: string;
  size: string;
  mass_kg: number;
  capacity: number;
  range_km: number;
  travel_speed_km_per_hour: number;
  gravity_generator: boolean;
  operational_temperature_c_min: number;
  operational_temperature_c_max: number;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Loads the supplied catalogue once at startup. Static and small, so it stays in
 * memory rather than the database; snake_case is normalised here, at the edge.
 */
@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private readonly bodies: Planet[];
  private readonly fleet: Spacecraft[];

  constructor() {
    const path =
      process.env.CATALOG_PATH ?? resolve(process.cwd(), '../../data/solar-system.sample.yaml');

    const raw = parse(readFileSync(path, 'utf8')) as {
      planets: RawPlanet[];
      spacecrafts: RawSpacecraft[];
    };

    this.bodies = raw.planets.map((p) => ({
      id: slugify(p.name),
      name: p.name,
      type: p.type === 'Star' ? ('Star' as const) : ('Planet' as const),
      distanceFromSunKm: p.distance_from_sun_km,
      diameterKm: p.diameter_km,
      averageTemperatureC: p.average_temperature_c,
      potentiallyHabitable: p.potentially_habitable,
      weatherPatterns: p.weather_patterns,
      radiationLevelsMsv: p.radiation_levels_msv,
      gravityMPerS2: p.gravity_m_per_s2,
      moons: p.moons ?? [],
    }));

    this.fleet = raw.spacecrafts.map((s) => ({
      id: slugify(s.name),
      name: s.name,
      size: s.size,
      massKg: s.mass_kg,
      capacity: s.capacity,
      rangeKm: s.range_km,
      travelSpeedKmPerHour: s.travel_speed_km_per_hour,
      gravityGenerator: s.gravity_generator,
      operationalTemperatureCMin: s.operational_temperature_c_min,
      operationalTemperatureCMax: s.operational_temperature_c_max,
    }));

    this.logger.log(`Loaded ${this.bodies.length} bodies and ${this.fleet.length} spacecraft`);
  }

  allBodies(): Planet[] {
    return this.bodies;
  }

  allSpacecraft(): Spacecraft[] {
    return this.fleet;
  }

  departure(): Planet {
    const earth = this.bodies.find((p) => p.name === DEPARTURE_PLANET_NAME);
    if (!earth) throw new Error(`Catalogue has no ${DEPARTURE_PLANET_NAME} to depart from.`);
    return earth;
  }

  /** Bodies an agent may choose. Excludes the origin and anything nothing can survive. */
  destinations(): Planet[] {
    return selectableDestinations(this.bodies, this.fleet, this.departure());
  }

  /** Excluded bodies with reasons, so the UI can explain the absence. */
  excluded(): { body: Planet; reason: string }[] {
    return unreachableBodies(this.bodies, this.fleet, this.departure());
  }

  spacecraftById(id: string): Spacecraft {
    const craft = this.fleet.find((s) => s.id === id);
    if (!craft) throw new NotFoundException(`Unknown spacecraft: ${id}`);
    return craft;
  }

  destinationsByIds(ids: readonly string[]): Planet[] {
    return ids.map((id) => {
      const body = this.bodies.find((p) => p.id === id);
      if (!body) throw new NotFoundException(`Unknown destination: ${id}`);
      return body;
    });
  }
}
