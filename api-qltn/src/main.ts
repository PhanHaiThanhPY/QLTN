import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp, prepareDatabase, SERVICE_NAME, setupSwagger } from './bootstrap';
import { QltnLogger } from './common/logging/qltn-logger';

async function bootstrap(): Promise<void> {
  const logger = new QltnLogger(SERVICE_NAME);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, bufferLogs: true });
  app.useLogger(logger);

  configureApp(app, { requestLog: true });
  const config = app.get(ConfigService);
  if (config.get<string>('nodeEnv') !== 'production') setupSwagger(app);

  await prepareDatabase(app);
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('port');
  await app.listen(port);
  logger.log(
    `Listening on http://localhost:${port}/api (docs: /api/docs, health: /api/public/health-check)`,
    'Bootstrap',
  );
}

bootstrap().catch((err: unknown) => {
  new QltnLogger(SERVICE_NAME).error(
    err instanceof Error ? err.message : String(err),
    err instanceof Error ? err.stack : undefined,
    'Bootstrap',
  );
  process.exit(1);
});
