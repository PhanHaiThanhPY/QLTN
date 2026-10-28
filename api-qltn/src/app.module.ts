import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CapabilitiesGuard } from './common/guards/capabilities.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { ALL_ENTITIES } from './database/entities';
import { AuditModule } from './modules/audit/audit.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { AuthModule } from './modules/auth/auth.module';
import { BuildingsModule } from './modules/buildings/buildings.module';
import { HealthModule } from './modules/health/health.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ExploitationModule } from './modules/exploitation/exploitation.module';
import { FundModule } from './modules/fund/fund.module';
import { DepositModule } from './modules/deposit/deposit.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { RecordsModule } from './modules/records/records.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('database.host'),
        port: config.getOrThrow<number>('database.port'),
        username: config.getOrThrow<string>('database.username'),
        password: config.getOrThrow<string>('database.password'),
        database: config.getOrThrow<string>('database.database'),
        entities: ALL_ENTITIES,
        // Schema changes only go through database/migrations/*.sql.
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }]),
    AuditModule,
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    RolesModule,
    OrganizationModule,
    BuildingsModule,
    RecordsModule,
    MaintenanceModule,
    TasksModule,
    FundModule,
    ExploitationModule,
    DepositModule,
    NotificationsModule,
    AttachmentsModule,
    ReferenceModule,
  ],
  providers: [
    // Guard order: rate limit → authentication → capabilities.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CapabilitiesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
