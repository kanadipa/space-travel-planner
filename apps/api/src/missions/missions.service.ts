import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { addYears, type Evaluation, type Spacecraft } from '../domain';
import { PlanningService } from '../planning/planning.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMissionDto, UpdateMissionDto } from './dto/mission-input.dto';

/** Ambiguous characters removed, so a reference read aloud is unambiguous. */
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface MissionInput {
  spacecraftId: string;
  passengerCount: number;
  destinationIds: string[];
  departureDate: Date;
  name?: string;
}

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planning: PlanningService,
    private readonly catalog: CatalogService,
  ) {}

  list() {
    return this.prisma.mission.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async get(id: string) {
    const mission = await this.prisma.mission.findUnique({ where: { id } });
    if (!mission) throw new NotFoundException(`No mission with id ${id}`);
    return mission;
  }

  async getByReference(reference: string) {
    const mission = await this.prisma.mission.findUnique({ where: { reference } });
    if (!mission) throw new NotFoundException(`No mission with reference ${reference}`);
    return mission;
  }

  async create(request: CreateMissionDto) {
    const { evaluation, craft } = this.validate(request);

    return this.prisma.mission.create({
      data: {
        reference: await this.uniqueReference(),
        ...this.derive(request, evaluation, craft),
      },
    });
  }

  async update(id: string, patch: UpdateMissionDto) {
    const existing = await this.get(id);

    const merged: MissionInput = {
      spacecraftId: patch.spacecraftId ?? existing.spacecraftId,
      passengerCount: patch.passengerCount ?? existing.passengerCount,
      destinationIds: patch.destinationIds ?? existing.destinationIds,
      departureDate: patch.departureDate ?? existing.departureDate,
      name: patch.name ?? existing.name,
    };

    const { evaluation, craft } = this.validate(merged);

    return this.prisma.mission.update({
      where: { id },
      data: this.derive(merged, evaluation, craft),
    });
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.mission.delete({ where: { id } });
  }

  /**
   * A well-formed request describing an infeasible mission is 422, not 400: the
   * payload was understood, the mission just cannot be flown. Everything is
   * recomputed here because trusting a client's figures would let a stale one
   * persist a physically impossible plan.
   */
  private validate(input: MissionInput): { evaluation: Evaluation; craft: Spacecraft } {
    const { evaluation, craft } = this.planning.evaluateOne(input);

    if (!evaluation.feasible) {
      throw new UnprocessableEntityException({
        message: 'This mission cannot be flown as configured.',
        failures: evaluation.failures,
      });
    }

    return { evaluation, craft };
  }

  private derive(input: MissionInput, evaluation: Evaluation, craft: Spacecraft) {
    const departureDate = new Date(input.departureDate);

    return {
      name: input.name?.trim() || this.deriveName(input, departureDate),
      spacecraftId: input.spacecraftId,
      passengerCount: input.passengerCount,
      destinationIds: input.destinationIds,
      departureDate,
      arrivalDate: addYears(departureDate, evaluation.durationYears),
      totalDistanceKm: evaluation.itinerary.totalDistanceKm,
      rangeConsumedKm: evaluation.rangeConsumedKm,
      durationYears: evaluation.durationYears,
      legs: toJson(evaluation.itinerary.legs),
      spacecraftSnapshot: toJson(craft),
    };
  }

  /** Falls back to destination, date and party size when the agent gives no name. */
  private deriveName(input: MissionInput, departureDate: Date): string {
    const names = this.catalog.destinationsByIds(input.destinationIds).map((p) => p.name);
    const where = names.length > 2 ? `${names[0]} +${names.length - 1}` : names.join(' & ');
    const when = departureDate.toISOString().slice(0, 10);
    return `${where} · ${when} · ${input.passengerCount} pax`;
  }

  private async uniqueReference(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = `${randomCode(5)}`;
      const clash = await this.prisma.mission.findUnique({ where: { reference: candidate } });
      if (!clash) return candidate;
    }
    throw new Error('Could not allocate a unique mission reference.');
  }
}

/** Narrows a domain object to the plain JSON Prisma will accept for a Json column. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function randomCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)];
  }
  return out;
}
