import { Global, Module } from '@nestjs/common';
import { EvaluationsController } from './evaluations.controller';
import { PlanningService } from './planning.service';

@Global()
@Module({
  controllers: [EvaluationsController],
  providers: [PlanningService],
  exports: [PlanningService],
})
export class PlanningModule {}
