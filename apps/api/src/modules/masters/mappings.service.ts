import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MAPPING_STATUS, SUPPLY_CONDITION, rupees, type PartMappingInput, type ListQuery,
} from '@erp/shared';
import { $Enums } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireTenantContext } from '../../prisma/tenant-context';
import { AuditService } from '../../prisma/audit.service';
import { paginate, searchAcross, compact } from '../../common/paginate';
import { toDbEnum, toDbEnumOrUndefined, fromDbEnum, fromDbEnumOrNull } from '../../common/enum-map';

const SORTABLE = ['customerPartNo', 'status', 'createdAt'] as const;

type MappingQuery = ListQuery & { customerId?: string; partId?: string; status?: string };

/**
 * Customer Part Mapping — our part number against the customer's own, with the
 * agreed price and supply condition. Quotations and sales orders will read the
 * price from here, which is why it is stored in paise as an integer.
 */
@Injectable()
export class MappingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: MappingQuery) {
    const where = compact({
      customerId: query.customerId,
      partId: query.partId,
      status: toDbEnumOrUndefined(query.status),
      ...searchAcross(query.q, ['customerPartNo', 'drawingRef']),
    });

    return paginate(this.prisma.scoped.partMapping as never, query, {
      where,
      include: {
        customer: { select: { id: true, name: true } },
        part: { select: { id: true, partNo: true, name: true, currentRevision: true, drawingNo: true } },
      },
      defaultSort: { createdAt: 'desc' },
      sortable: SORTABLE,
      facetField: 'status',
      mapRow: (m) => this.toDto(m as never),
    });
  }

  async findOne(id: string) {
    const mapping = await this.prisma.scoped.partMapping.findUnique({
      where: { id },
      include: { customer: true, part: true },
    });
    if (!mapping) throw new NotFoundException(`No mapping found for "${id}"`);
    return this.toDto(mapping as never);
  }

  async create(dto: PartMappingInput) {
    const { tenantId } = requireTenantContext();
    const mapping = await this.prisma.unscoped.partMapping.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        partId: dto.partId,
        customerPartNo: dto.customerPartNo,
        drawingRef: dto.drawingRef || null,
        pricePaise: dto.pricePaise != null ? BigInt(dto.pricePaise) : null,
        supplyCondition: dto.supplyCondition || null,
        status: toDbEnum<$Enums.MappingStatus>(dto.status ?? 'Mapped'),
      },
      include: { customer: true, part: true },
    });
    await this.audit.record('PartMapping', mapping.id, 'created');
    return this.toDto(mapping as never);
  }

  async update(id: string, dto: Partial<PartMappingInput>) {
    const before = await this.prisma.scoped.partMapping.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`No mapping found for "${id}"`);

    const data = compact({
      customerPartNo: dto.customerPartNo,
      drawingRef: dto.drawingRef,
      pricePaise: dto.pricePaise != null ? BigInt(dto.pricePaise) : undefined,
      supplyCondition: dto.supplyCondition,
      status: dto.status ? toDbEnum<$Enums.MappingStatus>(dto.status) : undefined,
    });

    const mapping = await this.prisma.scoped.partMapping.update({
      where: { id },
      data,
      include: { customer: true, part: true },
    });

    // Price changes are commercially significant, so they are always audited
    // with their before/after even though the generic diff would catch them.
    await this.audit.record('PartMapping', id, 'updated', AuditService.diff(before as never, data as never));
    return this.toDto(mapping as never);
  }

  async remove(id: string) {
    const mapping = await this.prisma.scoped.partMapping.update({
      where: { id },
      data: { status: 'OBSOLETE' },
    });
    await this.audit.record('PartMapping', id, 'archived');
    return this.toDto(mapping as never);
  }

  private toDto(m: Record<string, any>) {
    // BigInt does not survive JSON.stringify, so paise is narrowed to a number
    // here. Safe: Number.MAX_SAFE_INTEGER paise is ~90 trillion rupees.
    const pricePaise = m.pricePaise != null ? Number(m.pricePaise) : null;
    return {
      id: m.id,
      customer: m.customer ? { id: m.customer.id, name: m.customer.name } : null,
      part: m.part
        ? { id: m.part.id, partNo: m.part.partNo, name: m.part.name }
        : null,
      customerPartNo: m.customerPartNo,
      drawingRef: m.drawingRef ?? (m.part?.drawingNo && m.part?.currentRevision
        ? `${m.part.drawingNo} · ${m.part.currentRevision.replace(/^Rev /, '')}`
        : null),
      pricePaise,
      /** Formatted server-side so exports and the UI agree exactly. */
      priceDisplay: rupees(pricePaise),
      supplyCondition: fromDbEnumOrNull(
        m.supplyCondition ? toDbEnum(m.supplyCondition) : null,
        SUPPLY_CONDITION,
      ),
      status: fromDbEnum(m.status, MAPPING_STATUS),
      updatedAt: m.updatedAt,
    };
  }
}
