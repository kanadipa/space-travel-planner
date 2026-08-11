import { Injectable } from '@nestjs/common';
import type { Booking } from '../domain';
import { PrismaService } from '../prisma/prisma.service';

/** A booking plus the labels a refusal needs to name the mission in the way. */
export interface Commitment extends Booking {
  reference: string;
  name: string;
}

/**
 * Reads the saved missions as occupied windows.
 *
 * Lives beside the evaluator rather than in the missions module because both
 * consumers already depend on this module — `MissionsService` on `PlanningService`
 * for evaluation, and `EvaluationsController` directly — so keeping it here points
 * every arrow the same way. Putting it in the missions module would close a cycle.
 * It touches Prisma and nothing else, so it stays a thin read.
 */
@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async all(): Promise<Commitment[]> {
    const rows = await this.prisma.mission.findMany({
      select: {
        id: true,
        reference: true,
        name: true,
        spacecraftId: true,
        departureDate: true,
        arrivalDate: true,
      },
    });

    return rows.map((row) => ({
      missionId: row.id,
      reference: row.reference,
      name: row.name,
      spacecraftId: row.spacecraftId,
      departure: row.departureDate,
      arrival: row.arrivalDate,
    }));
  }
}
