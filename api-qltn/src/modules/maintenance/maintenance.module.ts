import { Module } from '@nestjs/common';
import { MaintenanceItemsController } from './maintenance-items.controller';
import { MaintenanceItemsService } from './maintenance-items.service';

@Module({
  controllers: [MaintenanceItemsController],
  providers: [MaintenanceItemsService],
})
export class MaintenanceModule {}
