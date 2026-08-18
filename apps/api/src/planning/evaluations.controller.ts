import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { addYears, conflictsFor } from '../domain';
import { EvaluateDto } from '../missions/dto/mission-input.dto';
import { BookingsService } from './bookings.service';
import { PlanningService } from './planning.service';

@Controller('evaluations')
export class EvaluationsController {
  constructor(
    private readonly planning: PlanningService,
    private readonly bookings: BookingsService,
  ) {}

  @Post()
  @HttpCode(200)
  async evaluate(@Body() body: EvaluateDto) {
    const result = this.planning.evaluateFleetFor(body);
    const bookings = await this.bookings.all();

    /* Each craft occupies a different window for the same route, because
       duration is distance over that craft's own speed. */
    const busySpacecraftIds = result.evaluations
      .filter((evaluation) => evaluation.feasible)
      .filter(
        (evaluation) =>
          conflictsFor(
            evaluation.spacecraftId,
            {
              departure: body.departureDate,
              arrival: addYears(body.departureDate, evaluation.durationYears),
            },
            bookings,
            body.editingMissionId,
          ).length > 0,
      )
      .map((evaluation) => evaluation.spacecraftId);

    return { ...result, busySpacecraftIds };
  }
}
