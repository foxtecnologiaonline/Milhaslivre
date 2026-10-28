import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap() {
  // rawBody: true makes request.rawBody available — needed to verify the
  // Pagar.me webhook signature against the exact bytes it was computed over.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const config = app.get(ConfigService<Env, true>);
  app.enableCors({ origin: config.get('FRONTEND_URL', { infer: true }), credentials: true });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}

bootstrap();
