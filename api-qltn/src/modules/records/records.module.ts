import { Module } from '@nestjs/common';
import { ConstructionController } from './construction.controller';
import { ConstructionService } from './construction.service';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  controllers: [RecordsController, ProposalsController, ConstructionController],
  providers: [RecordsService, ProposalsService, ConstructionService],
})
export class RecordsModule {}
