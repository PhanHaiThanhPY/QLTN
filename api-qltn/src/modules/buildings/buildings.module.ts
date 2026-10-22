import { Module } from '@nestjs/common';
import { BuildingConfigService } from './building-config.service';
import { BuildingConfigsController, BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { LocationsService } from './locations.service';

@Module({
  controllers: [BuildingsController, BuildingConfigsController],
  providers: [BuildingsService, LocationsService, BuildingConfigService],
  exports: [BuildingConfigService],
})
export class BuildingsModule {}
