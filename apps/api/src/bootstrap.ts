import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** Fail closed on misconfiguration: these have insecure dev fallbacks. */
export function assertProductionConfig() {
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_ORIGIN) {
    throw new Error('FRONTEND_ORIGIN must be set in production');
  }
}

/** Shared by the long-running server (main.ts) and the serverless entry
 *  (serverless.ts) so the two can never drift apart. */
export function configureApp(app: NestExpressApplication) {
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
}
