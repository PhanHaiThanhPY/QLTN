import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeCounterService } from '../../common/services/code-counter.service';
import { AuditService } from './audit.service';
import { AuditEvent } from './entities/audit-event.entity';

/** Cross-cutting write helpers every business module uses inside its transactions. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  providers: [AuditService, CodeCounterService],
  exports: [AuditService, CodeCounterService],
})
export class AuditModule {}
