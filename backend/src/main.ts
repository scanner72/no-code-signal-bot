import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import * as crypto from 'node:crypto';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: crypto.webcrypto,
  });
}
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { RedisIoAdapter } from './redis-io.adapter';
import { ensureAuthSchema } from './auth/auth';

async function bootstrap() {
  // Disable Nest's global body parser: better-auth's handler must read the raw
  // request stream itself. We re-apply JSON/urlencoded parsing below for every
  // route EXCEPT /api/auth, otherwise sign-up / sign-in requests hang.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const jsonParser = json();
  const urlencodedParser = urlencoded({ extended: true });
  app.use((req: any, res: any, next: any) => {
    if (req.originalUrl.startsWith('/api/auth')) return next();
    jsonParser(req, res, (err: any) =>
      err ? next(err) : urlencodedParser(req, res, next),
    );
  });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Ensure better-auth tables exist (not managed by TypeORM).
  try {
    await ensureAuthSchema();
    Logger.log('Auth schema ensured', 'Bootstrap');
  } catch (err) {
    Logger.error(`Failed to ensure auth schema: ${err}`, 'Bootstrap');
  }

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`Server running on http://localhost:${port}/api`, 'Bootstrap');
}
bootstrap();
