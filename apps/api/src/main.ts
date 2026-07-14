import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { assertProductionConfig, configureApp } from './bootstrap';

async function bootstrap() {
  assertProductionConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`QuestLine API ready on http://localhost:${port}`);
}

bootstrap();
