import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { MissionsModule } from './missions/missions.module';
import { PlanningModule } from './planning/planning.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, CatalogModule, PlanningModule, MissionsModule],
})
export class AppModule {}
