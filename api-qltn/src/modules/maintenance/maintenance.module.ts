import { Module } from '@nestjs/common';
import { RecordsModule } from '../records/records.module';
import { MaintenanceExecutionService } from './maintenance-execution.service';
import { MaintenanceGenerationService } from './maintenance-generation.service';
import { MaintenanceOccurrencesController } from './maintenance-occurrences.controller';
import { MaintenanceRemindersService } from './maintenance-reminders.service';
import { OccurrenceQueriesService } from './occurrence-queries.service';
import { RepairFromItemService } from './repair-from-item.service';
import { MaintenanceItemsController } from './maintenance-items.controller';
import { MaintenanceItemsService } from './maintenance-items.service';
import { MaintenanceOccurrencesService } from './maintenance-occurrences.service';
import { MaintenancePlansController } from './maintenance-plans.controller';
import { MaintenancePlansService } from './maintenance-plans.service';

@Module({
  imports: [RecordsModule],
  controllers: [MaintenanceItemsController, MaintenancePlansController, MaintenanceOccurrencesController],
  providers: [
    MaintenanceItemsService,
    MaintenancePlansService,
    MaintenanceOccurrencesService,
    MaintenanceGenerationService,
    MaintenanceExecutionService,
    OccurrenceQueriesService,
    RepairFromItemService,
    MaintenanceRemindersService,
  ],
  exports: [MaintenanceGenerationService],
})
export class MaintenanceModule {}
