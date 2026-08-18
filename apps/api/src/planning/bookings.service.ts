import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Booking } from '../domain';
import { PrismaService } from '../prisma/prisma.service';

/** A booking plus the labels a refusal needs to name the mission in the way. */
interface Commitment extends Booking {
  reference: string;
  name: string;
}

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass the transaction when one is open, so the check reads the insert's snapshot. */
  async all(client: Prisma.TransactionClient = this.prisma): Promise<Commitment[]> {
    const rows = await client.mission.findMany({
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
