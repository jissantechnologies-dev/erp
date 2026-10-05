import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import {
  DRAWING_STATUS, type DrawingInput, type DrawingRevisionInput, type ListQuery,
} from '@erp/shared';
import { $Enums } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireTenantContext } from '../../prisma/tenant-context';
import { AuditService } from '../../prisma/audit.service';
import { paginate, searchAcross, compact } from '../../common/paginate';
import { toDbEnum, toDbEnumOrUndefined, fromDbEnum } from '../../common/enum-map';

const SORTABLE = ['drawingNo', 'createdAt', 'updatedAt'] as const;

type DrawingQuery = ListQuery & { customerId?: string; status?: string; partId?: string };

/**
 * Drawing revision control.
 *
 * The register lists one row per *drawing*, showing its current revision — so
 * the service always resolves "current" the same way: the newest revision that
 * is RELEASED or PENDING_APPROVAL. Revisions themselves are append-only;
 * superseding is a status change on the old row, never a delete.
 */
@Injectable()
export class DrawingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: DrawingQuery) {
    const statusFilter = toDbEnumOrUndefined(query.status);

    const where = compact({
      customerId: query.customerId,
      partId: query.partId,
      // Filtering by status means "the current revision has this status".
      ...(statusFilter ? { revisions: { some: { status: statusFilter } } } : {}),
      ...searchAcross(query.q, ['drawingNo']),
    });

    return paginate(this.prisma.scoped.drawing as never, query, {
      where,
      include: {
        customer: { select: { id: true, name: true } },
        part: { select: { id: true, partNo: true, name: true } },
        revisions: { orderBy: { revisionDate: 'desc' } },
      },
      defaultSort: { updatedAt: 'desc' },
      sortable: SORTABLE,
      mapRow: (d) => this.toDto(d as never),
    });
  }

  async findOne(id: string) {
    const drawing = await this.prisma.scoped.drawing.findFirst({
      where: { OR: [{ id }, { drawingNo: id }] },
      include: {
        customer: true,
        part: { select: { id: true, partNo: true, name: true } },
        revisions: {
          orderBy: { revisionDate: 'desc' },
          include: { owner: { select: { id: true, displayName: true, fullName: true } } },
        },
      },
    });
    if (!drawing) throw new NotFoundException(`No drawing found for "${id}"`);
    return this.toDto(drawing as never, { full: true });
  }

  /** Creates the drawing together with its first revision ("A", first issue). */
  async create(dto: DrawingInput & { firstRevision?: DrawingRevisionInput }) {
    const { tenantId, userId } = requireTenantContext();

    const drawing = await this.prisma.unscoped.drawing.create({
      data: {
        tenantId,
        drawingNo: dto.drawingNo,
        partId: dto.partId,
        customerId: dto.customerId,
        revisions: {
          create: {
            revision: dto.firstRevision?.revision ?? 'A',
            revisionDate: dto.firstRevision?.revisionDate ?? new Date(),
            changeDescription: dto.firstRevision?.changeDescription ?? 'First issue',
            status: toDbEnum<$Enums.DrawingStatus>(dto.firstRevision?.status ?? 'Pending Approval'),
            ownerId: dto.firstRevision?.ownerId ?? userId ?? null,
          },
        },
      },
      include: { revisions: true, customer: true, part: true },
    });

    await this.audit.record('Drawing', drawing.id, 'created');
    return this.toDto(drawing as never, { full: true });
  }

  /**
   * Adds a revision. The previous current revision is marked SUPERSEDED in the
   * same transaction, so there is never a moment with two current revisions.
   * The parent part's `currentRevision` is kept in step.
   */
  async addRevision(drawingId: string, dto: DrawingRevisionInput) {
    const drawing = await this.prisma.scoped.drawing.findUnique({
      where: { id: drawingId },
      include: { revisions: true },
    });
    if (!drawing) throw new NotFoundException(`No drawing found for "${drawingId}"`);

    if (drawing.revisions.some((r) => r.revision.toUpperCase() === dto.revision.toUpperCase())) {
      throw new ConflictException({
        message: `Revision ${dto.revision} already exists on this drawing`,
        fieldErrors: { revision: 'Already exists' },
      });
    }

    const { userId } = requireTenantContext();

    const revision = await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.drawingRevision.updateMany({
        where: {
          drawingId,
          status: { in: ['RELEASED', 'PENDING_APPROVAL', 'UNDER_REVISION'] },
        },
        data: { status: 'SUPERSEDED' },
      });

      const created = await tx.drawingRevision.create({
        data: {
          drawingId,
          revision: dto.revision.toUpperCase(),
          revisionDate: dto.revisionDate,
          changeDescription: dto.changeDescription,
          status: toDbEnum<$Enums.DrawingStatus>(dto.status ?? 'Pending Approval'),
          ownerId: dto.ownerId ?? userId ?? null,
        },
      });

      // The design shows the part's current revision alongside its drawing, so
      // the two must not drift.
      await tx.part.update({
        where: { id: drawing.partId },
        data: { currentRevision: `Rev ${created.revision}`, status: 'UNDER_REVISION' },
      });

      return created;
    });

    await this.audit.record('Drawing', drawingId, 'revision-added', {
      revision: { from: null, to: revision.revision },
    });
    return this.findOne(drawingId);
  }

  /** Approving a pending revision releases it and returns the part to Released. */
  async approveRevision(drawingId: string, revisionId: string) {
    const drawing = await this.prisma.scoped.drawing.findUnique({ where: { id: drawingId } });
    if (!drawing) throw new NotFoundException(`No drawing found for "${drawingId}"`);

    await this.prisma.unscoped.$transaction(async (tx) => {
      const rev = await tx.drawingRevision.findFirstOrThrow({
        where: { id: revisionId, drawingId },
      });
      if (rev.status === 'RELEASED') {
        throw new ConflictException(`Revision ${rev.revision} is already released`);
      }
      await tx.drawingRevision.update({
        where: { id: revisionId },
        data: { status: 'RELEASED', approvedAt: new Date() },
      });
      await tx.part.update({
        where: { id: drawing.partId },
        data: { currentRevision: `Rev ${rev.revision}`, status: 'RELEASED' },
      });
    });

    await this.audit.record('Drawing', drawingId, 'revision-approved');
    return this.findOne(drawingId);
  }

  /** Newest revision that has not been superseded. */
  private static current(revisions: Record<string, any>[]) {
    return (
      revisions.find((r) => r.status !== 'SUPERSEDED') ?? revisions[0] ?? null
    );
  }

  private toDto(d: Record<string, any>, opts: { full?: boolean } = {}) {
    const revisions = d.revisions ?? [];
    const current = DrawingsService.current(revisions);

    const base = {
      id: d.id,
      drawingNo: d.drawingNo,
      part: d.part ? { id: d.part.id, partNo: d.part.partNo, name: d.part.name } : null,
      customer: d.customer ? { id: d.customer.id, name: d.customer.name } : null,
      currentRevision: current?.revision ?? null,
      revisionDate: current?.revisionDate ?? null,
      latestChange: current?.changeDescription ?? null,
      status: current ? fromDbEnum(current.status, DRAWING_STATUS) : null,
      owner: current?.owner?.displayName ?? current?.owner?.fullName ?? null,
      revisionCount: revisions.length,
    };

    if (!opts.full) return base;

    return {
      ...base,
      revisions: revisions.map((r: Record<string, any>) => ({
        id: r.id,
        revision: r.revision,
        revisionDate: r.revisionDate,
        changeDescription: r.changeDescription,
        status: fromDbEnum(r.status, DRAWING_STATUS),
        owner: r.owner?.displayName ?? r.owner?.fullName ?? null,
        approvedAt: r.approvedAt,
      })),
    };
  }
}
