import 'reflect-metadata';
/** Precarga TypeORM antes del grafo de AppModule; en FS lentos (p. ej. Desktop/iCloud) el primer require puede tardar >120s si ocurre detrás de Nest. */
import 'typeorm';
import { writeSync } from 'fs';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

/** Con `nohup … >> backend.log`, stderr no es TTY y `console.error` puede quedar bufferizado (log “vacío”). */
function bootLog(msg: string): void {
  try {
    writeSync(2, `[novaretail-api] ${msg}\n`);
  } catch {
    console.error(`[novaretail-api] ${msg}`);
  }
}

async function bootstrap() {
  bootLog('NestFactory.create(AppModule)…');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const origins = config.get<string[]>('corsOrigin') ?? ['http://localhost:8080'];
  app.enableCors({
    origin: origins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidUnknownValues: false,
      transform: true,
    }),
  );
  const port = config.get<number>('port') ?? 4000;
  await app.listen(port, '0.0.0.0');
  bootLog(`listening on 0.0.0.0:${port} (GET /api/health)`);
}

bootstrap().catch((err: unknown) => {
  try {
    writeSync(2, `[novaretail-api] bootstrap failed: ${String(err)}\n`);
  } catch {
    console.error('[novaretail-api] bootstrap failed:', err);
  }
  process.exit(1);
});
