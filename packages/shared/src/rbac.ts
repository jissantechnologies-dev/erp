/**
 * Permissions are `<module>:<action>` strings. Modules mirror the design's
 * NAV groups so a role can be granted or revoked exactly along the lines the
 * sidebar already draws.
 */

export const MODULES = [
  'dashboard', 'sales', 'masters', 'purchase', 'production', 'inventory',
  'quality', 'rejection', 'trace', 'maint', 'dispatch', 'reports', 'iso',
  'team', 'admin',
] as const;
export type Module = (typeof MODULES)[number];

export const ACTIONS = ['read', 'create', 'update', 'delete', 'approve', 'export'] as const;
export type Action = (typeof ACTIONS)[number];

export type Permission = `${Module}:${Action}` | `${Module}:*` | '*';

export const ALL_PERMISSIONS: Permission[] = MODULES.flatMap(
  (m) => ACTIONS.map((a) => `${m}:${a}` as Permission),
);

/**
 * Seeded system roles. A tenant gets these on creation and may add its own;
 * `isSystem` roles cannot be deleted, only copied.
 */
export const SYSTEM_ROLES: Record<string, { name: string; description: string; permissions: Permission[] }> = {
  owner: {
    name: 'Owner',
    description: 'Full access including billing and user management',
    permissions: ['*'],
  },
  plant_head: {
    name: 'Plant Head',
    description: 'Full operational access, no billing',
    permissions: MODULES.filter((m) => m !== 'admin').map((m) => `${m}:*` as Permission)
      .concat(['admin:read']),
  },
  sales: {
    name: 'Sales',
    description: 'Enquiries, quotations, orders and customers',
    permissions: ['dashboard:read', 'sales:*', 'masters:read', 'reports:read', 'team:*', 'dispatch:read'],
  },
  methods: {
    name: 'Methods / Engineering',
    description: 'Feasibility, part master, drawings and tooling',
    permissions: [
      'dashboard:read', 'sales:read', 'sales:update', 'masters:*',
      'production:read', 'reports:read', 'team:*', 'iso:read',
    ],
  },
  production: {
    name: 'Production',
    description: 'Planning, moulding, melting, casting and machining',
    permissions: [
      'dashboard:read', 'production:*', 'inventory:read', 'inventory:update',
      'masters:read', 'sales:read', 'trace:*', 'maint:read', 'reports:read', 'team:*',
    ],
  },
  quality: {
    name: 'Quality',
    description: 'Inspection, rejection, CAPA and ISO documents',
    permissions: [
      'dashboard:read', 'quality:*', 'rejection:*', 'trace:*', 'iso:*',
      'masters:read', 'production:read', 'reports:read', 'team:*',
    ],
  },
  stores: {
    name: 'Stores',
    description: 'Inventory, GRN and stock movement',
    permissions: [
      'dashboard:read', 'inventory:*', 'purchase:read', 'purchase:update',
      'dispatch:*', 'masters:read', 'reports:read', 'team:*',
    ],
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only across all modules',
    permissions: MODULES.map((m) => `${m}:read` as Permission),
  },
};

/** Does `granted` satisfy `required`? Supports `*` and `<module>:*` wildcards. */
export function can(granted: readonly string[], required: Permission): boolean {
  if (granted.includes('*')) return true;
  if (granted.includes(required)) return true;
  const [mod] = required.split(':');
  return granted.includes(`${mod}:*`);
}
