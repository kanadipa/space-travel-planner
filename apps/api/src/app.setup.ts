import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { AllExceptionsFilter } from './observability/all-exceptions.filter';

/** Shared by `main.ts` and the tests, so a test cannot pass against a pipeline nobody hits. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  return app;
}
