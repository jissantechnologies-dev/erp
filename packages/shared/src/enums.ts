/**
 * Domain enums, transcribed from the design prototype's BADGE map and
 * <select> option lists so the UI vocabulary and the DB stay in lockstep.
 * Values are the exact human-readable strings the design renders.
 */

export const PART_STATUS = ['Development', 'Released', 'Under Revision', 'Obsolete'] as const;
export type PartStatus = (typeof PART_STATUS)[number];

export const CASTING_PROCESS = ['Green sand', 'No-bake', 'Investment', 'Die casting', 'Shell moulding'] as const;
export type CastingProcess = (typeof CASTING_PROCESS)[number];

export const HEAT_TREATMENT = ['None', 'Stress relieving', 'Annealing', 'Normalising', 'Solution annealing'] as const;
export type HeatTreatment = (typeof HEAT_TREATMENT)[number];

export const SUPPLY_CONDITION = ['As cast', 'Rough machined', 'Fully machined', 'Machined & painted'] as const;
export type SupplyCondition = (typeof SUPPLY_CONDITION)[number];

export const PART_CATEGORY = [
  'Pump components', 'Valve components', 'Hydraulic blocks', 'Automotive', 'Agri components',
] as const;
export type PartCategory = (typeof PART_CATEGORY)[number];

export const UOM = ['Nos', 'Kg', 'Set'] as const;
export type Uom = (typeof UOM)[number];

export const MATERIAL_FAMILY = ['Cast Iron', 'SG Iron', 'Carbon Steel', 'Alloy Steel', 'Non-ferrous'] as const;
export type MaterialFamily = (typeof MATERIAL_FAMILY)[number];

export const ALLOY_STATUS = ['Approved', 'Pending Approval', 'Obsolete'] as const;
export type AlloyStatus = (typeof ALLOY_STATUS)[number];

export const DRAWING_STATUS = ['Released', 'Pending Approval', 'Under Revision', 'Superseded'] as const;
export type DrawingStatus = (typeof DRAWING_STATUS)[number];

export const TOOL_TYPE = ['Pattern', 'Core Box', 'Die', 'Fixture', 'Gauge'] as const;
export type ToolType = (typeof TOOL_TYPE)[number];

export const TOOL_STATUS = [
  'Available', 'In Use', 'Maintenance Due', 'Under Repair', 'Scrapped',
] as const;
export type ToolStatus = (typeof TOOL_STATUS)[number];

export const MAPPING_STATUS = ['Mapped', 'Under Revision', 'Obsolete'] as const;
export type MappingStatus = (typeof MAPPING_STATUS)[number];

export const CUSTOMER_STATUS = ['Active', 'Prospect', 'Inactive'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUS)[number];

/** Sales — defined now so the Masters FKs and badge map are complete. */
export const ENQUIRY_STATUS = ['Open', 'Feasibility', 'Quoted', 'Won', 'Regretted'] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUS)[number];

export const ENQUIRY_SOURCE = ['Email', 'Customer portal', 'Phone', 'Visit', 'Tender'] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCE)[number];

export const FEASIBILITY_STATUS = [
  'Pending', 'In Review', 'Feasible', 'Feasible with Deviation', 'Not Feasible',
] as const;
export type FeasibilityStatus = (typeof FEASIBILITY_STATUS)[number];

export const QUOTATION_STATUS = ['Draft', 'Sent', 'Revised', 'Accepted', 'Rejected'] as const;
export type QuotationStatus = (typeof QUOTATION_STATUS)[number];

export const SALES_ORDER_STATUS = [
  'In Production', 'Partially Dispatched', 'Completed', 'On Hold',
] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUS)[number];

export const DELIVERY_STATUS = ['Scheduled', 'Due Today', 'Overdue', 'Dispatched'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUS)[number];

export const INSPECTION_NEEDS = [
  'Standard', 'Dimensional + Hardness', 'Pressure test', 'NDT (MPI / UT)', 'Radiography',
] as const;
export type InspectionNeeds = (typeof INSPECTION_NEEDS)[number];

/**
 * status string -> badge class. Ported verbatim from the prototype's BADGE
 * constant; `badgeClass()` is the single source of truth for status colour.
 */
export const BADGE_CLASS: Record<string, string> = {
  Open: 'b-info', Feasibility: 'b-warn', Quoted: 'b-info', Won: 'b-ok', Regretted: 'b-mute',
  Pending: 'b-mute', 'In Review': 'b-warn', Feasible: 'b-ok',
  'Feasible with Deviation': 'b-warn', 'Not Feasible': 'b-bad',
  Draft: 'b-mute', Sent: 'b-info', Revised: 'b-warn', Accepted: 'b-ok', Rejected: 'b-bad',
  'In Production': 'b-info', 'Partially Dispatched': 'b-warn', Completed: 'b-ok', 'On Hold': 'b-bad',
  Dispatched: 'b-ok', 'Due Today': 'b-warn', Overdue: 'b-bad', Scheduled: 'b-info',
  Active: 'b-ok', Prospect: 'b-info', Inactive: 'b-mute',
  Released: 'b-ok', Development: 'b-info', 'Under Revision': 'b-warn', Obsolete: 'b-mute',
  Approved: 'b-ok', 'Pending Approval': 'b-warn', Superseded: 'b-mute',
  Available: 'b-ok', 'In Use': 'b-info', 'Maintenance Due': 'b-warn',
  'Under Repair': 'b-warn', Scrapped: 'b-mute', Mapped: 'b-ok',
};

export const badgeClass = (status: string): string => BADGE_CLASS[status] ?? 'b-mute';
