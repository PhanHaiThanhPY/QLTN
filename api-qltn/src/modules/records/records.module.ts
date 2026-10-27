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
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  controllers: [
    // Before RecordsController: `/records/schedule` must not be read as `/records/:id`.
    ScheduleController,
    RecordsController,
    ProposalsController,
    ConstructionController,
    PaymentsController,
    EmergencyController,
  ],
  providers: [
    RecordsService,
    ProposalsService,
    ConstructionService,
    PaymentsService,
    EmergencyService,
    ScheduleService,
  ],
  // MT-S3 BR-MT3-08: a record made from a failed maintenance item goes through the same createDraft.
  exports: [RecordsService],
})
export class RecordsModule {}
