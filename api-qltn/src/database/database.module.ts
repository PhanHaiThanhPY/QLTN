import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../modules/attachments/attachments.module';
import { ExploitationModule } from '../modules/exploitation/exploitation.module';
import { FundModule } from '../modules/fund/fund.module';
import { RecordsModule } from '../modules/records/records.module';
import { RolesModule } from '../modules/roles/roles.module';
import { DatabaseMigrationService } from './database-migration.service';
import { DatabaseSeedService } from './seeds/database-seed.service';

@Module({
  imports: [RolesModule, AttachmentsModule, RecordsModule, ExploitationModule, FundModule],
  providers: [DatabaseMigrationService, DatabaseSeedService],
  exports: [DatabaseMigrationService, DatabaseSeedService],
})
export class DatabaseModule {}
