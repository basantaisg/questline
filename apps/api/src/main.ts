import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // Fail closed on misconfiguration: these have insecure dev fallbacks.
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_ORIGIN) {
    throw new Error('FRONTEND_ORIGIN must be set in production');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security headers (CSP, HSTS, nosniff, frameguard, ...)
  app.use(helmet());
  app.use(cookieParser());

  // Strict CORS: only the frontend origin, with credentials for the refresh cookie.
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  // Reject unknown fields and coerce types on every DTO — first line of
  // defense against injection and mass-assignment.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Only trust X-Forwarded-For when actually behind a reverse proxy —
  // trusting it while directly exposed lets clients spoof their IP and
  // bypass rate limiting.
  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`QuestLine API ready on http://localhost:${port}`);
}

bootstrap();
