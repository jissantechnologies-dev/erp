import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  TOOL_TYPE, TOOL_STATUS, lifeBarTone, type ToolInput, type ListQuery,
} from '@erp/shared';
import { $Enums, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireTenantContext } from '../../prisma/tenant-context';
import { AuditService } from '../../prisma/audit.service';
import { paginate, searchAcross, compact } from '../../common/paginate';
import { toDbEnum, toDbEnumOrUndefined, fromDbEnum } from '../../common/enum-map';

const SORTABLE = ['code', 'type', 'status', 'usedShots', 'createdAt'] as const;

/** Life consumed at which a tool is flagged for maintenance, matching the
 *  design's amber threshold on the life bar. */
const MAINTENANCE_THRESHOLD = 0.85;

type ToolQuery = ListQuery & { type?: string; status?: string; partId?: string };

@Injectable()
export class ToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ToolQuery) {
    const where = compact({
      type: toDbEnumOrUndefined(query.type),
      status: toDbEnumOrUndefined(query.status),
      partId: query.partId,
      ...searchAcross(query.q, ['code', 'description', 'location', 'material']),
    });

    return paginate(this.prisma.scoped.tool as never, query, {
      where,
      include: { part: { select: { id: true, partNo: true, name: true } } },
      defaultSort: { code: 'asc' },
      sortable: SORTABLE,
      facetField: 'status',
      mapRow: (t) => this.toDto(t as never),
    });
  }

  async findOne(id: string) {
    const tool = await this.prisma.scoped.tool.findFirst({
      where: { OR: [{ id }, { code: id }] },
      include: { part: { select: { id: true, partNo: true, name: true, customer: { select: { name: true } } } } },
    });
    if (!tool) throw new NotFoundException(`No tool found for "${id}"`);
    return this.toDto(tool as never);
  }

  async create(dto: ToolInput) {
    const { tenantId } = requireTenantContext();
    const tool = await this.prisma.unscoped.tool.create({
      data: {
        tenantId,
        code: dto.code.toUpperCase(),
        type: toDbEnum<$Enums.ToolType>(dto.type),
        description: dto.description,
        partId: dto.partId || null,
        material: dto.material || null,
        cavities: dto.cavities,
        lifeShots: dto.lifeShots,
        usedShots: dto.usedShots,
        location: dto.location || null,
        status: toDbEnum<$Enums.ToolStatus>(dto.status ?? 'Available'),
        revision: dto.revision || null,
      },
      include: { part: true },
    });
    await this.audit.record('Tool', tool.id, 'created');
    return this.toDto(tool as never);
  }

  async update(id: string, dto: Partial<ToolInput>) {
    const before = await this.prisma.scoped.tool.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`No tool found for "${id}"`);

    // Cross-field check against the merged record, since a patch may change
    // only one of the two shot counts.
    const lifeShots = dto.lifeShots ?? before.lifeShots;
    const usedShots = dto.usedShots ?? before.usedShots;
    if (usedShots > lifeShots) {
      throw new BadRequestException({
        message: 'Please correct the highlighted fields',
        fieldErrors: { usedShots: 'Shots used cannot exceed rated life' },
      });
    }

    const data = compact({
      type: dto.type ? toDbEnum<$Enums.ToolType>(dto.type) : undefined,
      description: dto.description,
      partId: dto.partId,
      material: dto.material,
      cavities: dto.cavities,
      lifeShots: dto.lifeShots,
      usedShots: dto.usedShots,
      location: dto.location,
      status: dto.status ? toDbEnum<$Enums.ToolStatus>(dto.status) : undefined,
      revision: dto.revision,
    });

    const tool = await this.prisma.scoped.tool.update({
      where: { id },
      data,
      include: { part: true },
    });
    await this.audit.record('Tool', id, 'updated', AuditService.diff(before as never, data as never));
    return this.toDto(tool as never);
  }

  /**
   * Records shots consumed after a production run and escalates the status
   * automatically — the shop floor should not have to remember to flag a tool
   * as due for maintenance.
   *
   * Uses an atomic increment so two concurrent run postings cannot lose a count.
   */
  async recordShots(id: string, shots: number) {
    if (shots <= 0) {
      throw new BadRequestException({
        message: 'Please correct the highlighted fields',
        fieldErrors: { shots: 'Enter a positive number of shots' },
      });
    }

    const tool = await this.prisma.scoped.tool.findUnique({ where: { id } });
    if (!tool) throw new NotFoundException(`No tool found for "${id}"`);
    if (tool.status === 'SCRAPPED') {
      throw new BadRequestException('This tool is scrapped and cannot record further shots');
    }

    const projected = Math.min(tool.usedShots + shots, tool.lifeShots);
    const nextStatus =
      projected >= tool.lifeShots
        ? 'MAINTENANCE_DUE'
        : projected / tool.lifeShots >= MAINTENANCE_THRESHOLD
          ? 'MAINTENANCE_DUE'
          : tool.status;

    const updated = await this.prisma.scoped.tool.update({
      where: { id },
      data: {
        usedShots: { increment: Math.min(shots, tool.lifeShots - tool.usedShots) },
        status: nextStatus,
      },
      include: { part: true },
    });

    await this.audit.record('Tool', id, 'shots-recorded', {
      usedShots: { from: tool.usedShots, to: updated.usedShots },
      ...(nextStatus !== tool.status ? { status: { from: tool.status, to: nextStatus } } : {}),
    });
    return this.toDto(updated as never);
  }

  private toDto(t: Record<string, any>) {
    const life = lifeBarTone(t.usedShots, t.lifeShots);
    return {
      id: t.id,
      code: t.code,
      type: fromDbEnum(t.type, TOOL_TYPE),
      description: t.description,
      part: t.part ? { id: t.part.id, partNo: t.part.partNo, name: t.part.name } : null,
      material: t.material,
      cavities: t.cavities,
      lifeShots: t.lifeShots,
      usedShots: t.usedShots,
      /** Pre-computed so the table cell does not re-derive it per render. */
      lifeUsedPct: life.pct,
      lifeTone: life.tone,
      remainingShots: Math.max(0, t.lifeShots - t.usedShots),
      location: t.location,
      status: fromDbEnum(t.status, TOOL_STATUS),
      revision: t.revision,
      updatedAt: t.updatedAt,
    };
  }
}
