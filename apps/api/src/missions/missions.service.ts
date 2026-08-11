import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { addYears, conflictsFor, type Evaluation, type Spacecraft } from '../domain';
import { BookingsService } from '../planning/bookings.service';
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
    private readonly bookings: BookingsService,
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
    await this.assertAvailable(request, evaluation);

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
    await this.assertAvailable(merged, evaluation, id);

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

  /**
   * A craft cannot be in two places at once, so an occupied one is refused.
   *
   * 409 and not 422: the mission is physically flyable, it is the fleet calendar
   * that says no, and the fix is another craft or another date rather than a
   * different payload. Kept out of `validate` for the same reason it is kept out of
   * the domain evaluator — feasibility is physics and answers the same way every
   * time, whereas this answer depends on what is stored and changes as missions are
   * saved and deleted.
   *
   * Enforced here rather than only in the browser because the UI's warning is
   * advice from a previous evaluation: the client can be stale, or absent
   * altogether. The window is recomputed from the evaluation that was just run, so
   * it is the same arithmetic that is about to be written to `arrivalDate`.
   */
  private async assertAvailable(
    input: MissionInput,
    evaluation: Evaluation,
    ignoreMissionId?: string,
  ): Promise<void> {
    const departure = new Date(input.departureDate);
    const clashes = conflictsFor(
      input.spacecraftId,
      { departure, arrival: addYears(departure, evaluation.durationYears) },
      await this.bookings.all(),
      ignoreMissionId,
    );

    if (clashes.length === 0) return;

    const craft = this.catalog.spacecraftById(input.spacecraftId);
    const first = clashes[0]!;

    throw new ConflictException({
      message:
        `${craft.name} is already committed to ${first.reference} until ` +
        `${first.arrival.toISOString().slice(0, 10)}. Choose another craft or another ` +
        `departure date.`,
      conflicts: clashes.map((clash) => ({
        missionId: clash.missionId,
        reference: clash.reference,
        name: clash.name,
        departureDate: clash.departure.toISOString(),
        arrivalDate: clash.arrival.toISOString(),
      })),
    });
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
