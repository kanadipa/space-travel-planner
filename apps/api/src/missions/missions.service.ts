import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { addYears, conflictsFor, type Evaluation, type Spacecraft } from '../domain';
import { BookingsService } from '../planning/bookings.service';
import { PlanningService } from '../planning/planning.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMissionDto, UpdateMissionDto } from './dto/mission-input.dto';

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** An aborted transaction cannot be resumed, so retries re-run the whole booking. */
const BOOKING_ATTEMPTS = 5;

/** Postgres 40001, serialisation failure or deadlock. */
const WRITE_CONFLICT = 'P2034';

/** Unique violation, which here can only be `reference`. */
const UNIQUE_VIOLATION = 'P2002';

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

  async create(request: CreateMissionDto) {
    const { evaluation, craft } = this.validate(request);
    const data = this.derive(request, evaluation, craft);

    return this.book(async (tx) => {
      await this.assertAvailable(request, evaluation, undefined, tx);

      return tx.mission.create({
        data: { reference: await this.uniqueReference(tx), ...data },
      });
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
    const data = this.derive(merged, evaluation, craft);

    return this.book(async (tx) => {
      await this.assertAvailable(merged, evaluation, id, tx);

      return tx.mission.update({ where: { id }, data });
    });
  }

  /**
   * Write skew: both agents read a clear calendar and both inserts are legal on
   * their own, so only SERIALIZABLE refuses the second. Postgres aborts one; the
   * retry sees the committed booking and 409s.
   */
  private async book<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (attempt >= BOOKING_ATTEMPTS || !isRetryable(error)) throw error;
      }
    }
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.mission.delete({ where: { id } });
  }

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

  /** 409, not 422: the mission is flyable, the craft is just taken. See ASSUMPTIONS.md. */
  private async assertAvailable(
    input: MissionInput,
    evaluation: Evaluation,
    ignoreMissionId: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const departure = new Date(input.departureDate);
    const clashes = conflictsFor(
      input.spacecraftId,
      { departure, arrival: addYears(departure, evaluation.durationYears) },
      await this.bookings.all(tx),
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

  /**
   * Draws a code free as far as this transaction can see. The unique index is the
   * real guarantee — `book` retries the P2002 — so this only keeps that rare.
   */
  private async uniqueReference(tx: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = randomCode(5);
      const clash = await tx.mission.findUnique({ where: { reference: candidate } });
      if (!clash) return candidate;
    }
    throw new Error('Could not allocate a unique mission reference.');
  }
}

/** Aborted for a reason a second run can get past, rather than a refusal to repeat. */
function isRetryable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === WRITE_CONFLICT || error.code === UNIQUE_VIOLATION)
  );
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
