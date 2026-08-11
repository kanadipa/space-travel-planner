import { Global, Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { EvaluationsController } from './evaluations.controller';
import { PlanningService } from './planning.service';

@Global()
@Module({
  controllers: [EvaluationsController],
  providers: [PlanningService, BookingsService],
  exports: [PlanningService, BookingsService],
})
export class PlanningModule {}
