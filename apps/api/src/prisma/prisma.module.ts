import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NumberSeriesService } from './number-series.service';
import { AuditService } from './audit.service';

/** Global so every feature module can inject Prisma without re-importing. */
@Global()
@Module({
  providers: [PrismaService, NumberSeriesService, AuditService],
  exports: [PrismaService, NumberSeriesService, AuditService],
})
export class PrismaModule {}
