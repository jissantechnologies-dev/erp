import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  PART_STATUS, CASTING_PROCESS, HEAT_TREATMENT, SUPPLY_CONDITION,
  yieldPct, type PartInput, type ListQuery,
} from '@erp/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { $Enums } from '@prisma/client';
import { requireTenantContext } from '../../prisma/tenant-context';
import { NumberSeriesService } from '../../prisma/number-series.service';
import { AuditService } from '../../prisma/audit.service';
import { paginate, searchAcross, compact } from '../../common/paginate';
import { toDbEnum, toDbEnumOrUndefined, fromDbEnum, fromDbEnumOrNull } from '../../common/enum-map';

/** Columns the Part Master table offers for sorting. */
const SORTABLE = ['partNo', 'name', 'customerPartNo', 'castingWeightKg', 'machinedWeightKg', 'status', 'createdAt'] as const;

type PartQuery = ListQuery & {
  status?: string;
  alloyId?: string;
  castingProcess?: string;
  customerId?: string;
};

@Injectable()
export class PartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: NumberSeriesService,
    private readonly audit: AuditService,
  ) {}

  /* --------------------------------- List --------------------------------- */

  async list(query: PartQuery) {
    const where = compact({
      status: toDbEnumOrUndefined(query.status),
      alloyId: query.alloyId,
      customerId: query.customerId,
      castingProcess: query.castingProcess,
      ...searchAcross(query.q, ['partNo', 'name', 'customerPartNo', 'drawingNo']),
    });

    return paginate(this.prisma.scoped.part as never, query, {
      where,
      include: {
        customer: { select: { id: true, name: true, code: true } },
        alloy: { select: { id: true, code: true, name: true } },
        primaryTool: { select: { id: true, code: true } },
      },
      defaultSort: { partNo: 'asc' },
      sortable: SORTABLE,
      facetField: 'status',
      mapRow: (p) => this.toDto(p as never),
    });
  }

  /* -------------------------------- Detail -------------------------------- */

  async findOne(id: string) {
    const part = await this.prisma.scoped.part.findFirst({
      where: { OR: [{ id }, { partNo: id }] },
      include: {
        customer: true,
        alloy: { select: { id: true, code: true, name: true, family: true, standard: true } },
        primaryTool: true,
        characteristics: { orderBy: { sequence: 'asc' } },
        tools: { orderBy: { code: 'asc' } },
        mappings: { include: { customer: { select: { id: true, name: true } } } },
        drawings: {
          include: { revisions: { orderBy: { revisionDate: 'desc' } } },
        },
      },
    });
    if (!part) throw new NotFoundException(`No part found for "${id}"`);
    return this.toDto(part as never, { full: true });
  }

  /* -------------------------------- Create -------------------------------- */

  async create(dto: PartInput) {
    await this.assertReferences(dto);

    const { tenantId } = requireTenantContext();

    // The number and the row are created together, so a rejected insert does
    // not consume a number from the series. This runs on the raw transaction
    // client, which the Prisma extension does not wrap, so tenantId is set
    // explicitly here.
    const part = await this.prisma.$transaction(async (tx) => {
      const partNo = await this.numbers.next('part', tx);
      return tx.part.create({
        data: { ...this.toRow(dto), partNo, tenantId } as Prisma.PartUncheckedCreateInput,
        include: { customer: true, alloy: true },
      });
    });

    await this.audit.record('Part', part.id, 'created');
    return this.toDto(part as never);
  }

  /* -------------------------------- Update -------------------------------- */

  async update(id: string, dto: Partial<PartInput>) {
    const before = await this.prisma.scoped.part.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`No part found for "${id}"`);
    await this.assertReferences(dto);

    // Weight invariants are cross-field, so they are re-checked here against
    // the merged record: a patch that sets only machinedWeightKg must still be
    // validated against the stored castingWeightKg.
    const merged = {
      castingWeightKg: dto.castingWeightKg ?? Number(before.castingWeightKg),
      machinedWeightKg: dto.machinedWeightKg ?? (before.machinedWeightKg ? Number(before.machinedWeightKg) : undefined),
      pouredWeightKg: dto.pouredWeightKg ?? (before.pouredWeightKg ? Number(before.pouredWeightKg) : undefined),
    };
    if (merged.machinedWeightKg != null && merged.machinedWeightKg > merged.castingWeightKg) {
      throw new BadRequestException({
        message: 'Please correct the highlighted fields',
        fieldErrors: { machinedWeightKg: 'Machined weight cannot exceed casting weight' },
      });
    }
    if (merged.pouredWeightKg != null && merged.pouredWeightKg < merged.castingWeightKg) {
      throw new BadRequestException({
        message: 'Please correct the highlighted fields',
        fieldErrors: { pouredWeightKg: 'Poured weight must be at least the casting weight' },
      });
    }

    const data = this.toRow(dto as PartInput, { partial: true });
    const part = await this.prisma.scoped.part.update({
      where: { id },
      data,
      include: { customer: true, alloy: true },
    });

    await this.audit.record('Part', id, 'updated', AuditService.diff(before as never, data as never));
    return this.toDto(part as never);
  }

  /* -------------------------------- Delete -------------------------------- */

  /**
   * Parts are referenced by drawings, tooling and (soon) enquiries and orders,
   * so a hard delete is almost always wrong. We mark the part Obsolete instead,
   * which is also what the design's status list implies.
   */
  async archive(id: string) {
    const part = await this.prisma.scoped.part.update({
      where: { id },
      data: { status: 'OBSOLETE' },
    });
    await this.audit.record('Part', id, 'archived');
    return this.toDto(part as never);
  }

  /* -------------------------------- Helpers ------------------------------- */

  /** Confirms FKs belong to this tenant before Prisma raises a bare FK error. */
  private async assertReferences(dto: Partial<PartInput>): Promise<void> {
    const fieldErrors: Record<string, string> = {};

    if (dto.customerId) {
      const found = await this.prisma.scoped.customer.findUnique({ where: { id: dto.customerId } });
      if (!found) fieldErrors.customerId = 'Select a customer from the list';
    }
    if (dto.alloyId) {
      const found = await this.prisma.scoped.alloy.findUnique({ where: { id: dto.alloyId } });
      if (!found) fieldErrors.alloyId = 'Select a grade from the list';
    }
    if (dto.toolId) {
      const found = await this.prisma.scoped.tool.findUnique({ where: { id: dto.toolId } });
      if (!found) fieldErrors.toolId = 'Select a tool from the list';
    }

    if (Object.keys(fieldErrors).length) {
      throw new BadRequestException({ message: 'Please correct the highlighted fields', fieldErrors });
    }
  }

  /** DTO -> DB row, translating display enums to the Postgres spelling. */
  private toRow(dto: PartInput, opts: { partial?: boolean } = {}): Prisma.PartUncheckedUpdateInput {
    const row = {
      name: dto.name,
      category: dto.category,
      customerId: dto.customerId,
      customerPartNo: dto.customerPartNo,
      status: dto.status ? toDbEnum<$Enums.PartStatus>(dto.status) : undefined,
      alloyId: dto.alloyId,
      castingProcess: dto.castingProcess,
      heatTreatment: dto.heatTreatment,
      toolId: dto.toolId,
      cavitiesPerMould: dto.cavitiesPerMould,
      coresPerCasting: dto.coresPerCasting,
      castingWeightKg: dto.castingWeightKg,
      machinedWeightKg: dto.machinedWeightKg,
      pouredWeightKg: dto.pouredWeightKg,
      uom: dto.uom,
      supplyCondition: dto.supplyCondition,
      drawingNo: dto.drawingNo || undefined,
      currentRevision: dto.currentRevision || undefined,
      customerSpec: dto.customerSpec || undefined,
      generalTolerance: dto.generalTolerance || undefined,
      surfaceFinish: dto.surfaceFinish || undefined,
      painting: dto.painting || undefined,
    };
    return (opts.partial ? compact(row) : row) as Prisma.PartUncheckedUpdateInput;
  }

  /**
   * DB row -> API shape. Decimals become numbers, enums become display strings
   * and `yieldPct` is computed rather than stored, matching the design's
   * read-only Yield field.
   */
  private toDto(p: Record<string, any>, opts: { full?: boolean } = {}) {
    const castingWeightKg = Number(p.castingWeightKg);
    const pouredWeightKg = p.pouredWeightKg != null ? Number(p.pouredWeightKg) : null;
    const machinedWeightKg = p.machinedWeightKg != null ? Number(p.machinedWeightKg) : null;

    const base = {
      id: p.id,
      partNo: p.partNo,
      name: p.name,
      category: p.category,
      status: fromDbEnum(p.status, PART_STATUS),
      customer: p.customer ? { id: p.customer.id, name: p.customer.name, code: p.customer.code } : null,
      customerPartNo: p.customerPartNo,
      alloy: p.alloy ? { id: p.alloy.id, code: p.alloy.code, name: p.alloy.name } : null,
      castingProcess: fromDbEnumOrNull(p.castingProcess ? toDbEnum(p.castingProcess) : null, CASTING_PROCESS),
      heatTreatment: fromDbEnumOrNull(p.heatTreatment ? toDbEnum(p.heatTreatment) : null, HEAT_TREATMENT),
      supplyCondition: fromDbEnumOrNull(p.supplyCondition ? toDbEnum(p.supplyCondition) : null, SUPPLY_CONDITION),
      primaryTool: p.primaryTool ? { id: p.primaryTool.id, code: p.primaryTool.code } : null,
      cavitiesPerMould: p.cavitiesPerMould,
      coresPerCasting: p.coresPerCasting,
      castingWeightKg,
      machinedWeightKg,
      pouredWeightKg,
      /** Derived: casting / poured. Null until a poured weight is recorded. */
      yieldPct: pouredWeightKg ? yieldPct(castingWeightKg, pouredWeightKg) : null,
      machiningLossKg: machinedWeightKg != null ? castingWeightKg - machinedWeightKg : null,
      uom: p.uom,
      drawingNo: p.drawingNo,
      currentRevision: p.currentRevision,
      updatedAt: p.updatedAt,
    };

    if (!opts.full) return base;

    return {
      ...base,
      customerSpec: p.customerSpec,
      generalTolerance: p.generalTolerance,
      surfaceFinish: p.surfaceFinish,
      painting: p.painting,
      characteristics: p.characteristics ?? [],
      tools: p.tools ?? [],
      mappings: p.mappings ?? [],
      drawings: p.drawings ?? [],
    };
  }
}
