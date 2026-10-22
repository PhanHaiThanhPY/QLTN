import { Module } from '@nestjs/common';
import { RolesModule } from '../modules/roles/roles.module';
import { DatabaseMigrationService } from './database-migration.service';
import { DatabaseSeedService } from './seeds/database-seed.service';

@Module({
  imports: [RolesModule],
  providers: [DatabaseMigrationService, DatabaseSeedService],
  exports: [DatabaseMigrationService, DatabaseSeedService],
})
export class DatabaseModule {}
