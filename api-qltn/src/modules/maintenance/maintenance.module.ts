import { Module } from '@nestjs/common';
import { MaintenanceGenerationService } from './maintenance-generation.service';
import { MaintenanceItemsController } from './maintenance-items.controller';
import { MaintenanceItemsService } from './maintenance-items.service';
import { MaintenanceOccurrencesService } from './maintenance-occurrences.service';
import { MaintenancePlansController } from './maintenance-plans.controller';
import { MaintenancePlansService } from './maintenance-plans.service';

@Module({
  controllers: [MaintenanceItemsController, MaintenancePlansController],
  providers: [
    MaintenanceItemsService,
    MaintenancePlansService,
    MaintenanceOccurrencesService,
    MaintenanceGenerationService,
  ],
  exports: [MaintenanceGenerationService],
})
export class MaintenanceModule {}
