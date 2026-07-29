import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { EvaluateDto } from '../missions/dto/mission-input.dto';
import { PlanningService } from './planning.service';

@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly planning: PlanningService) {}

  /**
   * POST rather than GET because the input is a structured object, not a handful
   * of scalars that belong in a query string.
   *
   * Always 200. "No craft can fly this" is a valid answer to a valid question,
   * so the client reads `anyFeasible` rather than catching an error.
   */
  @Post()
  @HttpCode(200)
  evaluate(@Body() body: EvaluateDto) {
    return this.planning.evaluateFleetFor(body);
  }
}
