import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { MissionsModule } from './missions/missions.module';
import { PlanningModule } from './planning/planning.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, CatalogModule, PlanningModule, MissionsModule],
  controllers: [HealthController],
})
export class AppModule {}
