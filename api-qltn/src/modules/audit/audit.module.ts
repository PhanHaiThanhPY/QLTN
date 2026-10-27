import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeCounterService } from '../../common/services/code-counter.service';
import { Clock } from '../../common/services/clock.service';
import { JobScheduler } from '../../common/services/job-scheduler.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditService } from './audit.service';
import { AuditEvent } from './entities/audit-event.entity';

/** Cross-cutting helpers every business module uses: audit and codes inside its transactions, and the job scheduler. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  controllers: [AuditLogController],
  providers: [AuditService, AuditLogService, CodeCounterService, JobScheduler, Clock],
  exports: [AuditService, CodeCounterService, JobScheduler, Clock],
})
export class AuditModule {}
