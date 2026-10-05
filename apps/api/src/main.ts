import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('bootstrap');

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN')!.split(',').map((s) => s.trim()),
    credentials: true, // required for the refresh-token cookie
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant'],
  });

  // No global ValidationPipe: validation is done per-route by ZodValidationPipe
  // against the schemas in @erp/shared. Nest's ValidationPipe would require
  // class-validator and a parallel set of DTO classes, which would be a second
  // source of truth for the same rules.

  if (process.env.NODE_ENV !== 'production') {
    const spec = new DocumentBuilder()
      .setTitle('Indus ERP API')
      .setDescription('Multi-tenant foundry ERP. Send X-Tenant in development.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addGlobalParameters({
        name: 'X-Tenant',
        in: 'header',
        required: false,
        schema: { type: 'string' },
        description: 'Workspace slug (development only; production uses the subdomain)',
      })
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, spec));
  }

  // BigInt (PartMapping.pricePaise) is not JSON-serialisable by default.
  // Services narrow it to a number, but this guards anything that slips past.
  (BigInt.prototype as unknown as { toJSON(): string }).toJSON = function () {
    return this.toString();
  };

  const port = config.get<number>('PORT')!;
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/api`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger at http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
