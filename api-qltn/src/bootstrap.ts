import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { correlationIdMiddleware } from './common/context/correlation-id.middleware';
import { httpLogger } from './common/logging/qltn-logger';
import { validationExceptionFactory } from './common/validation/validation-error.factory';
import { DatabaseMigrationService } from './database/database-migration.service';
import { DatabaseSeedService } from './database/seeds/database-seed.service';

export const SERVICE_NAME = 'api-qltn';

/** HTTP pipeline shared by main.ts and the e2e tests, so tests exercise the real setup. */
export function configureApp(app: NestExpressApplication, options: { requestLog: boolean }): void {
  const config = app.get(ConfigService);

  // Behind one reverse proxy (nginx): trust its X-Forwarded-For for req.ip and rate limiting.
  app.set('trust proxy', 1);
  app.use(correlationIdMiddleware);
  if (options.requestLog) app.use(httpLogger(SERVICE_NAME));
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.useBodyParser('json', { limit: '2mb' });

  const origins = config.get<string[]>('corsOrigins', []);
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['X-Correlation-ID'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
}

export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('QLTN API')
      .setDescription('Quản lý sửa chữa & bảo trì tòa nhà')
      .setVersion('0.1')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);
}

/** Schema first, then seed data: the seed writes into tables the migrations create. */
export async function prepareDatabase(app: INestApplication): Promise<void> {
  await app.get(DatabaseMigrationService).run();
  await app.get(DatabaseSeedService).run();
}
