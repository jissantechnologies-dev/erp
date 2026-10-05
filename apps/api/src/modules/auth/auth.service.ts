import {
  Injectable, UnauthorizedException, ConflictException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import {
  SYSTEM_ROLES, type JwtPayload, type LoginInput, type RegisterTenantInput,
} from '@erp/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithTenant } from '../../prisma/tenant-context';

export type AuthTokens = { accessToken: string; refreshToken: string; expiresIn: number };

/** Document number series every new tenant starts with. */
const DEFAULT_NUMBER_SERIES = [
  { docType: 'part', prefix: 'IF-', padding: 4 },
  { docType: 'customer', prefix: 'CUS-', padding: 4 },
  { docType: 'enquiry', prefix: 'ENQ-', padding: 4 },
  { docType: 'feasibility', prefix: 'FS-', padding: 4 },
  { docType: 'quotation', prefix: 'QT-', padding: 4 },
  { docType: 'salesOrder', prefix: 'SO-', padding: 4 },
  { docType: 'tool', prefix: 'PAT-', padding: 4 },
  { docType: 'heat', prefix: 'H-', padding: 4 },
  { docType: 'grn', prefix: 'GRN-', padding: 4 },
];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /* ------------------------------- Sign in -------------------------------- */

  async login(dto: LoginInput, claimedTenantSlug?: string): Promise<AuthTokens & { user: unknown }> {
    // Cross-tenant by necessity: we do not know the tenant until we know the
    // user. Hence `unscoped` plus an explicit tenant filter below.
    const slug = claimedTenantSlug ?? dto.tenantSlug;

    const users = await this.prisma.unscoped.user.findMany({
      where: {
        email: dto.email,
        isActive: true,
        tenant: slug ? { slug } : { status: { in: ['TRIAL', 'ACTIVE'] } },
      },
      include: {
        tenant: true,
        roles: { include: { role: true } },
        plants: true,
      },
    });

    if (users.length === 0) {
      // Uniform message and a dummy verify, so a wrong email and a wrong
      // password take the same time and reveal the same thing.
      await argon2.verify(
        '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9v',
        dto.password,
      ).catch(() => undefined);
      throw new UnauthorizedException('Email or password is incorrect');
    }

    if (users.length > 1) {
      throw new ConflictException({
        message: 'This email belongs to more than one workspace. Choose one to continue.',
        workspaces: users.map((u) => ({ slug: u.tenant.slug, name: u.tenant.name })),
      });
    }

    const user = users[0];
    if (!user.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    if (user.tenant.status === 'SUSPENDED' || user.tenant.status === 'CANCELLED') {
      throw new UnauthorizedException('This workspace is not active. Contact your administrator.');
    }

    await this.prisma.unscoped.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const permissions = [...new Set(user.roles.flatMap((ur) => ur.role.permissions))];
    const plantIds = user.plants.map((p) => p.plantId);

    const tokens = await this.issueTokens({
      sub: user.id,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      email: user.email,
      permissions,
      plantIds,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        tenant: { slug: user.tenant.slug, name: user.tenant.name },
        roles: user.roles.map((ur) => ur.role.name),
        permissions,
        plantIds,
      },
    };
  }

  /* ------------------------------ Token issue ----------------------------- */

  private async issueTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
    });

    // Refresh tokens are opaque random values, not JWTs: that way revoking one
    // is a DB write rather than a blocklist we have to consult on every call.
    const raw = randomBytes(48).toString('base64url');
    const ttlDays = Number(this.config.get<string>('JWT_REFRESH_TTL_DAYS') ?? 30);
    await this.prisma.unscoped.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: AuthService.hash(raw),
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });

    return { accessToken, refreshToken: raw, expiresIn: 15 * 60 };
  }

  private static hash = (token: string): string =>
    createHash('sha256').update(token).digest('hex');

  /* -------------------------------- Refresh ------------------------------- */

  /**
   * Rotates the refresh token on every use. If a token that has already been
   * revoked is presented, we treat it as theft and revoke the user's whole
   * family of tokens rather than just rejecting the one request.
   */
  async refresh(rawToken: string): Promise<AuthTokens> {
    const existing = await this.prisma.unscoped.refreshToken.findUnique({
      where: { tokenHash: AuthService.hash(rawToken) },
      include: {
        user: { include: { tenant: true, roles: { include: { role: true } }, plants: true } },
      },
    });

    if (!existing) throw new UnauthorizedException('Session expired. Sign in again.');

    if (existing.revokedAt) {
      this.logger.warn(`Reuse of revoked refresh token for user ${existing.userId}; revoking all sessions`);
      await this.prisma.unscoped.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session expired. Sign in again.');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Sign in again.');
    }

    await this.prisma.unscoped.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const u = existing.user;
    return this.issueTokens({
      sub: u.id,
      tenantId: u.tenantId,
      tenantSlug: u.tenant.slug,
      email: u.email,
      permissions: [...new Set(u.roles.flatMap((ur) => ur.role.permissions))],
      plantIds: u.plants.map((p) => p.plantId),
    });
  }

  async logout(rawToken: string): Promise<void> {
    await this.prisma.unscoped.refreshToken.updateMany({
      where: { tokenHash: AuthService.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /* --------------------------- Tenant provisioning ------------------------ */

  /**
   * Creates the workspace, its system roles, a default plant, the number series
   * and the first Owner user — all in one transaction, so a half-provisioned
   * tenant cannot exist.
   */
  async registerTenant(dto: RegisterTenantInput): Promise<AuthTokens & { user: unknown }> {
    const taken = await this.prisma.unscoped.tenant.findUnique({ where: { slug: dto.slug } });
    if (taken) {
      throw new ConflictException({
        message: 'That workspace URL is already taken',
        fieldErrors: { slug: 'Already taken' },
      });
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const { tenant, user } = await this.prisma.unscoped.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { slug: dto.slug, name: dto.companyName, status: 'TRIAL' },
      });

      await tx.role.createMany({
        data: Object.entries(SYSTEM_ROLES).map(([key, r]) => ({
          tenantId: tenant.id,
          key,
          name: r.name,
          description: r.description,
          permissions: r.permissions as string[],
          isSystem: true,
        })),
      });

      await tx.numberSeries.createMany({
        data: DEFAULT_NUMBER_SERIES.map((s) => ({ ...s, tenantId: tenant.id })),
      });

      const plant = await tx.plant.create({
        data: { tenantId: tenant.id, code: 'MAIN', name: `${dto.companyName} — Main Works`, isDefault: true },
      });

      const ownerRole = await tx.role.findFirstOrThrow({
        where: { tenantId: tenant.id, key: 'owner' },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          fullName: dto.fullName,
          displayName: AuthService.initialise(dto.fullName),
          passwordHash,
          roles: { create: { roleId: ownerRole.id } },
          plants: { create: { plantId: plant.id } },
        },
      });

      return { tenant, user };
    });

    this.logger.log(`Provisioned tenant ${tenant.slug} (${tenant.id})`);

    const permissions = SYSTEM_ROLES.owner.permissions as string[];
    const tokens = await this.issueTokens({
      sub: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      email: user.email,
      permissions,
      plantIds: [],
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenant: { slug: tenant.slug, name: tenant.name },
        roles: ['Owner'],
        permissions,
      },
    };
  }

  /**
   * The signed-in user in the shape the web app's AuthProvider stores. Read
   * from the database rather than the token, so a role change takes effect on
   * the next page load instead of waiting for the token to expire.
   */
  async currentUser(ctx: { userId?: string; tenantId: string }) {
    if (!ctx.userId) throw new UnauthorizedException('Sign in to continue');

    const user = await this.prisma.unscoped.user.findFirst({
      where: { id: ctx.userId, tenantId: ctx.tenantId, isActive: true },
      include: { tenant: true, roles: { include: { role: true } }, plants: true },
    });
    if (!user) throw new UnauthorizedException('Your account is no longer active');

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      displayName: user.displayName,
      tenant: { slug: user.tenant.slug, name: user.tenant.name },
      roles: user.roles.map((ur) => ur.role.name),
      permissions: [...new Set(user.roles.flatMap((ur) => ur.role.permissions))],
      plantIds: user.plants.map((p) => p.plantId),
    };
  }

  /** "Arun Vasudevan" -> "Arun V." — the short form the design's tables show. */
  private static initialise(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }

  /** Runs `fn` inside a tenant context; used by seeds and background jobs. */
  withTenant<T>(tenantId: string, tenantSlug: string, fn: () => T): T {
    return runWithTenant({ tenantId, tenantSlug, permissions: ['*'], plantIds: [] }, fn);
  }
}
