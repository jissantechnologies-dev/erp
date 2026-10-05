import type { Module, Permission } from './rbac.js';

export type NavItem = {
  /** Route path under /app, e.g. "masters/parts". */
  path: string;
  label: string;
  /** Not yet implemented -> renders the shared ComingSoon page. */
  soon?: boolean;
};

export type NavGroup = {
  key: Module;
  label: string;
  /** Material Symbols Outlined ligature name. */
  icon: string;
  permission: Permission;
  items: NavItem[];
};

/**
 * Ported from the prototype's NAV constant, preserving group order, labels and
 * icons exactly. `soon: true` marks the screens that exist only as placeholders
 * in the design; they render ComingSoon until built.
 */
export const NAV: NavGroup[] = [
  {
    key: 'dashboard', label: 'Dashboard', icon: 'space_dashboard', permission: 'dashboard:read',
    items: [],
  },
  {
    key: 'sales', label: 'Sales', icon: 'storefront', permission: 'sales:read',
    items: [
      { path: 'sales/enquiries', label: 'Enquiries / RFQ', soon: true },
      { path: 'sales/feasibility', label: 'Feasibility', soon: true },
      { path: 'sales/quotations', label: 'Quotations', soon: true },
      { path: 'sales/orders', label: 'Sales Orders', soon: true },
      { path: 'sales/delivery', label: 'Delivery Schedule', soon: true },
      { path: 'sales/customers', label: 'Customers' },
    ],
  },
  {
    key: 'masters', label: 'Products & Masters', icon: 'category', permission: 'masters:read',
    items: [
      { path: 'masters/parts', label: 'Part Master' },
      { path: 'masters/alloys', label: 'Material / Alloy' },
      { path: 'masters/drawings', label: 'Drawing Revision' },
      { path: 'masters/tooling', label: 'Pattern / Die / Tool' },
      { path: 'masters/mapping', label: 'Customer Part Mapping' },
    ],
  },
  {
    key: 'purchase', label: 'Purchase', icon: 'shopping_cart', permission: 'purchase:read',
    items: [
      { path: 'purchase/rfq', label: 'Purchase RFQ', soon: true },
      { path: 'purchase/supplier-quotations', label: 'Supplier Quotations', soon: true },
      { path: 'purchase/orders', label: 'Purchase Orders', soon: true },
      { path: 'purchase/grn', label: 'GRN', soon: true },
      { path: 'purchase/suppliers', label: 'Suppliers', soon: true },
    ],
  },
  {
    key: 'production', label: 'Production', icon: 'precision_manufacturing', permission: 'production:read',
    items: [
      { path: 'production/planning', label: 'Production Planning', soon: true },
      { path: 'production/mrp', label: 'MRP', soon: true },
      { path: 'production/capacity', label: 'Capacity Planning', soon: true },
      { path: 'production/mould-core', label: 'Mould & Core', soon: true },
      { path: 'production/melting', label: 'Melting & Furnace', soon: true },
      { path: 'production/casting', label: 'Casting', soon: true },
      { path: 'production/machining', label: 'Machining', soon: true },
      { path: 'production/wip', label: 'WIP', soon: true },
    ],
  },
  {
    key: 'inventory', label: 'Inventory', icon: 'inventory_2', permission: 'inventory:read',
    items: [
      { path: 'inventory/raw-materials', label: 'Raw Materials', soon: true },
      { path: 'inventory/scrap', label: 'Scrap', soon: true },
      { path: 'inventory/consumables', label: 'Consumables', soon: true },
      { path: 'inventory/wip', label: 'WIP', soon: true },
      { path: 'inventory/finished-goods', label: 'Finished Goods', soon: true },
      { path: 'inventory/transfer', label: 'Stock Transfer', soon: true },
      { path: 'inventory/ledger', label: 'Stock Ledger', soon: true },
    ],
  },
  {
    key: 'quality', label: 'Quality', icon: 'verified', permission: 'quality:read',
    items: [
      { path: 'quality/incoming', label: 'Incoming Inspection', soon: true },
      { path: 'quality/in-process', label: 'In-Process Inspection', soon: true },
      { path: 'quality/final', label: 'Final Inspection', soon: true },
      { path: 'quality/chemical', label: 'Chemical Analysis', soon: true },
      { path: 'quality/dimensional', label: 'Dimensional Inspection', soon: true },
      { path: 'quality/ndt', label: 'NDT', soon: true },
      { path: 'quality/reports', label: 'Quality Reports', soon: true },
    ],
  },
  {
    key: 'rejection', label: 'Rejection & Rework', icon: 'report', permission: 'rejection:read',
    items: [
      { path: 'rejection/entry', label: 'Rejection Entry', soon: true },
      { path: 'rejection/defects', label: 'Defect Register', soon: true },
      { path: 'rejection/rework', label: 'Rework', soon: true },
      { path: 'rejection/scrap', label: 'Scrap', soon: true },
      { path: 'rejection/capa', label: 'Root Cause / CAPA', soon: true },
    ],
  },
  {
    key: 'trace', label: 'Traceability', icon: 'account_tree', permission: 'trace:read',
    items: [
      { path: 'trace/heats', label: 'Heat Register', soon: true },
      { path: 'trace/batches', label: 'Batch Register', soon: true },
      { path: 'trace/heat-casting', label: 'Heat → Casting', soon: true },
      { path: 'trace/casting-machining', label: 'Casting → Machining', soon: true },
      { path: 'trace/complete', label: 'Complete Traceability', soon: true },
    ],
  },
  {
    key: 'maint', label: 'Maintenance', icon: 'build', permission: 'maint:read',
    items: [
      { path: 'maint/machines', label: 'Machines', soon: true },
      { path: 'maint/preventive', label: 'Preventive Maintenance', soon: true },
      { path: 'maint/breakdown', label: 'Breakdown', soon: true },
      { path: 'maint/spares', label: 'Spare Parts', soon: true },
      { path: 'maint/history', label: 'Maintenance History', soon: true },
    ],
  },
  {
    key: 'dispatch', label: 'Dispatch', icon: 'local_shipping', permission: 'dispatch:read',
    items: [
      { path: 'dispatch/finished-goods', label: 'Finished Goods', soon: true },
      { path: 'dispatch/planning', label: 'Delivery Planning', soon: true },
      { path: 'dispatch/packing', label: 'Packing', soon: true },
      { path: 'dispatch/dispatch', label: 'Dispatch', soon: true },
      { path: 'dispatch/challan', label: 'Delivery Challan', soon: true },
    ],
  },
  {
    key: 'reports', label: 'Costing & Reports', icon: 'monitoring', permission: 'reports:read',
    items: [
      { path: 'reports/product-costing', label: 'Product Costing', soon: true },
      { path: 'reports/production', label: 'Production Reports', soon: true },
      { path: 'reports/quality', label: 'Quality Reports', soon: true },
      { path: 'reports/inventory', label: 'Inventory Reports', soon: true },
      { path: 'reports/profitability', label: 'Costing & Profitability', soon: true },
      { path: 'reports/oee', label: 'OEE', soon: true },
      { path: 'reports/mis', label: 'MIS Dashboard', soon: true },
    ],
  },
  {
    key: 'iso', label: 'ISO & Documents', icon: 'description', permission: 'iso:read',
    items: [
      { path: 'iso/documents', label: 'Documents', soon: true },
      { path: 'iso/sop', label: 'SOP / Work Instructions', soon: true },
      { path: 'iso/ncr', label: 'NCR', soon: true },
      { path: 'iso/capa', label: 'CAPA', soon: true },
      { path: 'iso/audit', label: 'Internal Audit', soon: true },
      { path: 'iso/calibration', label: 'Calibration', soon: true },
    ],
  },
  {
    key: 'team', label: 'Team', icon: 'forum', permission: 'team:read',
    items: [
      { path: 'team/chat', label: 'Chat', soon: true },
      { path: 'team/tasks', label: 'Tasks', soon: true },
      { path: 'team/announcements', label: 'Announcements', soon: true },
    ],
  },
  {
    key: 'admin', label: 'Administration', icon: 'settings', permission: 'admin:read',
    items: [
      { path: 'admin/users', label: 'Users & Roles', soon: true },
      { path: 'admin/employees', label: 'Employees', soon: true },
      { path: 'admin/departments', label: 'Departments', soon: true },
      { path: 'admin/shifts', label: 'Shifts', soon: true },
      { path: 'admin/uom', label: 'UOM', soon: true },
      { path: 'admin/settings', label: 'Settings', soon: true },
      { path: 'admin/number-series', label: 'Number Series', soon: true },
    ],
  },
];

/** Flat path -> {group, item} lookup, for breadcrumbs and active-state. */
export const NAV_INDEX = new Map(
  NAV.flatMap((g) => g.items.map((it) => [it.path, { group: g, item: it }] as const)),
);
