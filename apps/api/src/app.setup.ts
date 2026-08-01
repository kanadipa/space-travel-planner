import { ValidationPipe, type INestApplication } from '@nestjs/common';

/**
 * Applies the request pipeline shared by the running server and the tests.
 *
 * The prefix and the pipe used to be configured inline in `bootstrap()`. That
 * left integration tests re-declaring them, so a test could pass against a
 * pipeline that no longer matched the one users hit. Both now call this.
 *
 * `whitelist` strips properties the DTO does not declare, so a client cannot
 * smuggle extra fields through; `transform` turns the plain JSON body into a
 * DTO instance so `@Type(() => Date)` produces a real Date.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app;
}
