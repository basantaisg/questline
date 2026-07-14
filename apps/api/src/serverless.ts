import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { assertProductionConfig, configureApp } from './bootstrap';

/** Reused across invocations that land on a warm container, so we only pay
 *  the Nest bootstrap cost on a cold start. */
let cached: express.Express | null = null;

export async function createServer(): Promise<express.Express> {
  if (cached) return cached;

  assertProductionConfig();

  const expressApp = express();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressApp),
  );
  configureApp(app);

  // init() rather than listen(): the platform owns the socket, we only
  // need the Express request handler wired up.
  await app.init();

  cached = expressApp;
  return expressApp;
}
