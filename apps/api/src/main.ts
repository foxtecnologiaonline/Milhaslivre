import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true makes request.rawBody available — needed to verify the
  // Pagar.me webhook signature against the exact bytes it was computed over.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
