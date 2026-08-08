import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { EvaluateDto } from '../missions/dto/mission-input.dto';
import { PlanningService } from './planning.service';

@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly planning: PlanningService) {}

  /**
   * Always 200: "nothing can fly this" is a valid answer to a valid question, so
   * the client reads `anyFeasible` rather than catching an error.
   */
  @Post()
  @HttpCode(200)
  evaluate(@Body() body: EvaluateDto) {
    return this.planning.evaluateFleetFor(body);
  }
}
