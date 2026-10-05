import { z } from 'zod';
import { req } from './common.js';
import { ALL_PERMISSIONS } from '../rbac.js';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: req('Password', 200),
  /** Only needed when TENANT_STRATEGY=header and the user belongs to >1 tenant. */
  tenantSlug: z.string().trim().toLowerCase().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

/** Tenant self-signup: creates the tenant, its number series and an Owner user. */
export const registerTenantSchema = z.object({
  companyName: req('Company Name'),
  slug: req('Workspace URL', 40)
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, 'Use lowercase letters, numbers and hyphens'),
  fullName: req('Your Name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
});
export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;

export const roleSchema = z.object({
  name: req('Role Name', 60),
  description: z.string().trim().max(200).optional(),
  permissions: z.array(z.enum(['*', ...ALL_PERMISSIONS] as [string, ...string[]])).min(1, 'Grant at least one permission'),
});
export type RoleInput = z.infer<typeof roleSchema>;

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  fullName: req('Full Name'),
  roleIds: z.array(z.string()).min(1, 'Assign at least one role'),
  plantIds: z.array(z.string()).default([]),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

/** Shape of the JWT access-token payload. */
export type JwtPayload = {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  email: string;
  permissions: string[];
  plantIds: string[];
};
