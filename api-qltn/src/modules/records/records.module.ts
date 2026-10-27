import { Module } from '@nestjs/common';
import { ConstructionController } from './construction.controller';
import { ConstructionService } from './construction.service';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  controllers: [
    RecordsController,
    ProposalsController,
    ConstructionController,
    PaymentsController,
    EmergencyController,
  ],
  providers: [RecordsService, ProposalsService, ConstructionService, PaymentsService, EmergencyService],
})
export class RecordsModule {}
