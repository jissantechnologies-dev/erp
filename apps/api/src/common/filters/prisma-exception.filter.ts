import {
  ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Turns Prisma's error codes into messages an operator can act on. Unique
 * violations in particular are common here (part numbers, tool codes), and the
 * default Prisma text names the DB constraint rather than the field.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(err: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | undefined) ?? [];
        // Strip the tenant column — it is an implementation detail here.
        const fields = target.filter((f) => f !== 'tenantId');
        const label = fields.length ? fields.join(' + ') : 'value';
        res.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: `That ${label} is already in use`,
          fieldErrors: Object.fromEntries(fields.map((f) => [f, 'Already in use'])),
        });
        return;
      }
      case 'P2025':
        res.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND, message: 'Record not found',
        });
        return;
      case 'P2003':
      case 'P2014':
        res.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: 'Another record depends on this one, so it cannot be changed or removed',
        });
        return;
      default:
        this.logger.error(`Unhandled Prisma error ${err.code}: ${err.message}`);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Something went wrong',
        });
    }
  }
}
