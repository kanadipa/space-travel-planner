import { ValidationPipe, type INestApplication } from '@nestjs/common';

/**
 * The request pipeline, shared by `main.ts` and the tests so a test cannot pass
 * against a pipeline users do not hit. `whitelist` stops a client smuggling
 * fields the DTO does not declare; `transform` gives `@Type(() => Date)` a Date.
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
