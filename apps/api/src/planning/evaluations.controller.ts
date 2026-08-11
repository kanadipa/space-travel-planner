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

  /**
   * Always 200: "nothing can fly this" is a valid answer to a valid question, so
   * the client reads `anyFeasible` rather than catching an error.
   *
   * `busySpacecraftIds` is deliberately separate from `feasible` even though both
   * now block a save. Feasibility is physics: it answers the same way every time
   * and is why a craft can never fly this route. Being committed is scheduling: it
   * answers from the database and changes as missions are saved and deleted, which
   * is also why it stays out of `Evaluation` and out of the domain layer. The save
   * path re-checks it and answers 409 — this list is what lets the UI say so before
   * the agent gets that far.
   */
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
