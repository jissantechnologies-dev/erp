import { Injectable, NotFoundException } from '@nestjs/common';
import { ALLOY_STATUS, MATERIAL_FAMILY, type AlloyInput, type ListQuery } from '@erp/shared';
import { $Enums } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireTenantContext } from '../../prisma/tenant-context';
import { AuditService } from '../../prisma/audit.service';
import { paginate, searchAcross, compact } from '../../common/paginate';
import { toDbEnum, toDbEnumOrUndefined, fromDbEnum } from '../../common/enum-map';

const SORTABLE = ['code', 'name', 'family', 'standard', 'status', 'createdAt'] as const;

type AlloyQuery = ListQuery & { family?: string; status?: string };

@Injectable()
export class AlloysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AlloyQuery) {
    const where = compact({
      family: query.family,
      status: toDbEnumOrUndefined(query.status),
      ...searchAcross(query.q, ['code', 'name', 'standard', 'equivalentGrades']),
    });

    return paginate(this.prisma.scoped.alloy as never, query, {
      where,
      defaultSort: { code: 'asc' },
      sortable: SORTABLE,
      facetField: 'family',
      include: { _count: { select: { parts: true } } },
      mapRow: (a) => this.toDto(a as never),
    });
  }

  async findOne(id: string) {
    const alloy = await this.prisma.scoped.alloy.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: {
        chemistry: { orderBy: { sequence: 'asc' } },
        mechanicalProperties: { orderBy: { sequence: 'asc' } },
        chargeMix: { orderBy: { sequence: 'asc' } },
        _count: { select: { parts: true } },
      },
    });
    if (!alloy) throw new NotFoundException(`No grade found for "${id}"`);
    return this.toDto(alloy as never, { full: true });
  }

  /**
   * Chemistry and mechanical rows are written with the parent in one
   * transaction, because a grade without its limits is not usable by Quality.
   */
  async create(dto: AlloyInput) {
    const { tenantId } = requireTenantContext();

    const alloy = await this.prisma.unscoped.alloy.create({
      data: {
        tenantId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        family: dto.family,
        standard: dto.standard || null,
        equivalentGrades: dto.equivalentGrades || null,
        status: toDbEnum<$Enums.AlloyStatus>(dto.status ?? 'Pending Approval'),
        tensileStrengthMpa: dto.tensileStrengthMpa,
        proofStressMpa: dto.proofStressMpa,
        elongationPct: dto.elongationPct,
        hardnessHb: dto.hardnessHb || null,
        pouringTempC: dto.pouringTempC || null,
        densityGCm3: dto.densityGCm3,
        chemistry: {
          create: dto.chemistry.map((c, i) => ({
            element: c.element.trim(),
            minPct: c.min ?? null,
            maxPct: c.max ?? null,
            remarks: c.remarks || null,
            sequence: i,
          })),
        },
        mechanicalProperties: {
          create: dto.mechanicalProperties.map((m, i) => ({
            property: m.property,
            requirement: m.requirement,
            testMethod: m.testMethod || null,
            testBar: m.testBar || null,
            sequence: i,
          })),
        },
      },
      include: { chemistry: true, mechanicalProperties: true },
    });

    await this.audit.record('Alloy', alloy.id, 'created');
    return this.toDto(alloy as never, { full: true });
  }

  /**
   * Child rows are replaced wholesale rather than diffed. The chemistry table
   * is small and edited as a unit in the design's form, so a replace is both
   * simpler and free of partial-update ordering bugs.
   */
  async update(id: string, dto: Partial<AlloyInput>) {
    const before = await this.prisma.scoped.alloy.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`No grade found for "${id}"`);

    const scalar = compact({
      name: dto.name,
      family: dto.family,
      standard: dto.standard,
      equivalentGrades: dto.equivalentGrades,
      status: dto.status ? toDbEnum<$Enums.AlloyStatus>(dto.status) : undefined,
      tensileStrengthMpa: dto.tensileStrengthMpa,
      proofStressMpa: dto.proofStressMpa,
      elongationPct: dto.elongationPct,
      hardnessHb: dto.hardnessHb,
      pouringTempC: dto.pouringTempC,
      densityGCm3: dto.densityGCm3,
    });

    const alloy = await this.prisma.unscoped.$transaction(async (tx) => {
      if (dto.chemistry) {
        await tx.chemistryLimit.deleteMany({ where: { alloyId: id } });
        await tx.chemistryLimit.createMany({
          data: dto.chemistry.map((c, i) => ({
            alloyId: id,
            element: c.element.trim(),
            minPct: c.min ?? null,
            maxPct: c.max ?? null,
            remarks: c.remarks || null,
            sequence: i,
          })),
        });
      }
      if (dto.mechanicalProperties) {
        await tx.mechanicalProperty.deleteMany({ where: { alloyId: id } });
        await tx.mechanicalProperty.createMany({
          data: dto.mechanicalProperties.map((m, i) => ({
            alloyId: id,
            property: m.property,
            requirement: m.requirement,
            testMethod: m.testMethod || null,
            testBar: m.testBar || null,
            sequence: i,
          })),
        });
      }
      return tx.alloy.update({
        where: { id },
        data: scalar,
        include: { chemistry: { orderBy: { sequence: 'asc' } }, mechanicalProperties: true },
      });
    });

    await this.audit.record('Alloy', id, 'updated', AuditService.diff(before as never, scalar as never));
    return this.toDto(alloy as never, { full: true });
  }

  private toDto(a: Record<string, any>, opts: { full?: boolean } = {}) {
    const base = {
      id: a.id,
      code: a.code,
      name: a.name,
      family: fromDbEnum(toDbEnum(a.family), MATERIAL_FAMILY),
      standard: a.standard,
      equivalentGrades: a.equivalentGrades,
      status: fromDbEnum(a.status, ALLOY_STATUS),
      tensileStrengthMpa: a.tensileStrengthMpa != null ? Number(a.tensileStrengthMpa) : null,
      hardnessHb: a.hardnessHb,
      partCount: a._count?.parts ?? 0,
    };
    if (!opts.full) return base;
    return {
      ...base,
      proofStressMpa: a.proofStressMpa != null ? Number(a.proofStressMpa) : null,
      elongationPct: a.elongationPct != null ? Number(a.elongationPct) : null,
      pouringTempC: a.pouringTempC,
      densityGCm3: a.densityGCm3 != null ? Number(a.densityGCm3) : null,
      chemistry: (a.chemistry ?? []).map((c: Record<string, any>) => ({
        id: c.id,
        element: c.element,
        min: c.minPct != null ? Number(c.minPct) : null,
        max: c.maxPct != null ? Number(c.maxPct) : null,
        /** Midpoint the design shows as "Target"; null when only a max exists. */
        target: c.minPct != null && c.maxPct != null
          ? (Number(c.minPct) + Number(c.maxPct)) / 2
          : null,
        remarks: c.remarks,
      })),
      mechanicalProperties: a.mechanicalProperties ?? [],
      chargeMix: (a.chargeMix ?? []).map((m: Record<string, any>) => ({
        id: m.id, input: m.input, qtyKg: Number(m.qtyKg),
      })),
    };
  }
}
