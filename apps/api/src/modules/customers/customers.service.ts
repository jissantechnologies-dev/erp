import { Injectable, NotFoundException } from '@nestjs/common';
import { CUSTOMER_STATUS, type CustomerInput, type ListQuery } from '@erp/shared';
import { $Enums } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireTenantContext } from '../../prisma/tenant-context';
import { NumberSeriesService } from '../../prisma/number-series.service';
import { AuditService } from '../../prisma/audit.service';
import { paginate, searchAcross, compact } from '../../common/paginate';
import { toDbEnum, toDbEnumOrUndefined, fromDbEnum } from '../../common/enum-map';

const SORTABLE = ['code', 'name', 'city', 'status', 'since', 'createdAt'] as const;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberSeriesService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListQuery & { status?: string; state?: string }) {
    const where = compact({
      status: toDbEnumOrUndefined(query.status),
      state: query.state,
      ...searchAcross(query.q, ['code', 'name', 'city', 'industry']),
    });

    return paginate(this.prisma.scoped.customer as never, query, {
      where,
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        _count: { select: { parts: true } },
      },
      defaultSort: { name: 'asc' },
      sortable: SORTABLE,
      facetField: 'status',
      mapRow: (c) => this.toDto(c as never),
    });
  }

  async findOne(id: string) {
    const customer = await this.prisma.scoped.customer.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: {
        contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
        parts: {
          select: { id: true, partNo: true, name: true, status: true, castingWeightKg: true },
          orderBy: { partNo: 'asc' },
        },
        _count: { select: { parts: true, mappings: true } },
      },
    });
    if (!customer) throw new NotFoundException(`No customer found for "${id}"`);
    return this.toDto(customer as never, { full: true });
  }

  /** Lightweight list for the <select> controls on every Masters form. */
  async options() {
    const rows = await this.prisma.scoped.customer.findMany({
      where: { status: { in: ['ACTIVE', 'PROSPECT'] } },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
    return rows;
  }

  async create(dto: CustomerInput) {
    const { tenantId } = requireTenantContext();

    const customer = await this.prisma.$transaction(async (tx) => {
      const code = await this.numbers.next('customer', tx);
      return tx.customer.create({
        data: {
          tenantId,
          code,
          name: dto.name,
          city: dto.city || null,
          state: dto.state || null,
          industry: dto.industry || null,
          gstin: dto.gstin || null,
          status: toDbEnum<$Enums.CustomerStatus>(dto.status ?? 'Prospect'),
          since: new Date(),
          ...(dto.contact
            ? {
                contacts: {
                  create: {
                    name: dto.contact.name,
                    designation: dto.contact.designation || null,
                    phone: dto.contact.phone || null,
                    email: dto.contact.email || null,
                    isPrimary: true,
                  },
                },
              }
            : {}),
        },
        include: { contacts: true },
      });
    });

    await this.audit.record('Customer', customer.id, 'created');
    return this.toDto(customer as never);
  }

  async update(id: string, dto: Partial<CustomerInput>) {
    const before = await this.prisma.scoped.customer.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`No customer found for "${id}"`);

    const data = compact({
      name: dto.name,
      city: dto.city,
      state: dto.state,
      industry: dto.industry,
      gstin: dto.gstin,
      status: dto.status ? toDbEnum<$Enums.CustomerStatus>(dto.status) : undefined,
    });

    const customer = await this.prisma.scoped.customer.update({
      where: { id },
      data,
      include: { contacts: true },
    });
    await this.audit.record('Customer', id, 'updated', AuditService.diff(before as never, data as never));
    return this.toDto(customer as never);
  }

  private toDto(c: Record<string, any>, opts: { full?: boolean } = {}) {
    const primary = (c.contacts ?? []).find((x: Record<string, any>) => x.isPrimary) ?? c.contacts?.[0];
    const base = {
      id: c.id,
      code: c.code,
      name: c.name,
      city: c.city,
      state: c.state,
      industry: c.industry,
      status: fromDbEnum(c.status, CUSTOMER_STATUS),
      since: c.since,
      contact: primary
        ? {
            name: primary.name,
            designation: primary.designation,
            phone: primary.phone,
            email: primary.email,
          }
        : null,
      partCount: c._count?.parts ?? 0,
    };
    if (!opts.full) return base;
    return {
      ...base,
      gstin: c.gstin,
      contacts: c.contacts ?? [],
      mappingCount: c._count?.mappings ?? 0,
      parts: (c.parts ?? []).map((p: Record<string, any>) => ({
        id: p.id,
        partNo: p.partNo,
        name: p.name,
        status: p.status,
        castingWeightKg: Number(p.castingWeightKg),
      })),
    };
  }
}
