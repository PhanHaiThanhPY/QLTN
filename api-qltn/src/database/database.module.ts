import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../modules/attachments/attachments.module';
import { RolesModule } from '../modules/roles/roles.module';
import { DatabaseMigrationService } from './database-migration.service';
import { DatabaseSeedService } from './seeds/database-seed.service';

@Module({
  imports: [RolesModule, AttachmentsModule],
  providers: [DatabaseMigrationService, DatabaseSeedService],
  exports: [DatabaseMigrationService, DatabaseSeedService],
})
export class DatabaseModule {}
