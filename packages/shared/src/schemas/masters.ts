import { z } from 'zod';
import { req, opt, decimalFromInput, listQuerySchema } from './common.js';
import {
  PART_STATUS, PART_CATEGORY, CASTING_PROCESS, HEAT_TREATMENT, SUPPLY_CONDITION, UOM,
  MATERIAL_FAMILY, ALLOY_STATUS, DRAWING_STATUS, TOOL_TYPE, TOOL_STATUS, MAPPING_STATUS,
} from '../enums.js';

/* ------------------------------- Part Master ------------------------------ */
/**
 * Field set transcribed from `partForm()` in the design prototype.
 *
 * The plain object is kept separate from the refined schema because `.refine()`
 * returns a ZodEffects, which has no `.partial()` — the PATCH schema therefore
 * derives from `partFields`. Cross-field weight invariants are re-checked
 * server-side against the merged record (see PartsService.update).
 */
const partFields = z.object({
  // Identification — partNo is server-assigned from the number series.
  name: req('Part Name'),
  category: z.enum(PART_CATEGORY).optional(),
  customerId: req('Customer'),
  customerPartNo: req('Customer Part No.', 80),
  status: z.enum(PART_STATUS).default('Development'),

  // Material & process
  alloyId: req('Alloy Grade'),
  castingProcess: z.enum(CASTING_PROCESS).optional(),
  heatTreatment: z.enum(HEAT_TREATMENT).default('None'),
  toolId: z.string().optional().nullable(),
  cavitiesPerMould: z.coerce.number().int().positive().max(64).optional(),
  coresPerCasting: z.coerce.number().int().nonnegative().max(64).optional(),

  // Weights
  castingWeightKg: decimalFromInput('Casting Weight'),
  machinedWeightKg: decimalFromInput('Machined Weight').optional(),
  pouredWeightKg: decimalFromInput('Poured Weight').optional(),
  uom: z.enum(UOM).default('Nos'),
  supplyCondition: z.enum(SUPPLY_CONDITION).optional(),

  // Drawing & specification
  drawingNo: opt(80),
  currentRevision: opt(16),
  customerSpec: opt(400),
  generalTolerance: opt(60),
  surfaceFinish: opt(120),
  painting: opt(120),
});

export const partSchema = partFields
  .refine((d) => d.machinedWeightKg == null || d.machinedWeightKg <= d.castingWeightKg, {
    path: ['machinedWeightKg'],
    message: 'Machined weight cannot exceed casting weight',
  })
  .refine((d) => d.pouredWeightKg == null || d.pouredWeightKg >= d.castingWeightKg, {
    path: ['pouredWeightKg'],
    message: 'Poured weight must be at least the casting weight (it includes gating and risers)',
  });

export type PartInput = z.infer<typeof partSchema>;
export const partUpdateSchema = partFields.partial();

export const partQuerySchema = listQuerySchema.extend({
  status: z.enum(PART_STATUS).optional(),
  alloyId: z.string().optional(),
  castingProcess: z.enum(CASTING_PROCESS).optional(),
  customerId: z.string().optional(),
});

/* ---------------------------- Material / Alloy ---------------------------- */
/** One row of the chemistry limits table in `alloy-new`. */
export const chemistryLimitSchema = z.object({
  element: req('Element', 4),
  min: decimalFromInput('Min').optional().nullable(),
  max: decimalFromInput('Max').optional().nullable(),
  remarks: opt(160),
}).refine((d) => d.min == null || d.max == null || d.min <= d.max, {
  path: ['max'], message: 'Max must be greater than or equal to Min',
});

export const mechanicalPropertySchema = z.object({
  property: req('Property', 80),
  requirement: req('Requirement', 80),
  testMethod: opt(60),
  testBar: opt(60),
});

export const alloySchema = z.object({
  code: req('Grade Code', 24).regex(/^[A-Z0-9-]+$/i, 'Use letters, numbers and hyphens only'),
  name: req('Grade Name'),
  family: z.enum(MATERIAL_FAMILY),
  standard: opt(80),
  equivalentGrades: opt(200),
  status: z.enum(ALLOY_STATUS).default('Pending Approval'),

  tensileStrengthMpa: decimalFromInput('Tensile Strength').optional(),
  proofStressMpa: decimalFromInput('Proof Stress').optional(),
  elongationPct: decimalFromInput('Elongation').optional(),
  hardnessHb: opt(32),
  pouringTempC: opt(32),
  densityGCm3: decimalFromInput('Density').optional(),

  chemistry: z.array(chemistryLimitSchema).default([]),
  mechanicalProperties: z.array(mechanicalPropertySchema).default([]),
});
export type AlloyInput = z.infer<typeof alloySchema>;
export const alloyUpdateSchema = alloySchema.partial();

export const alloyQuerySchema = listQuerySchema.extend({
  family: z.enum(MATERIAL_FAMILY).optional(),
  status: z.enum(ALLOY_STATUS).optional(),
});

/* --------------------------- Drawing Revision ----------------------------- */
/** A Drawing holds the identity; each DrawingRevision is an immutable record.
 *  Releasing a revision supersedes the previous one (see DrawingsService). */
export const drawingSchema = z.object({
  drawingNo: req('Drawing No.', 80),
  partId: req('Part'),
  customerId: req('Customer'),
});
export type DrawingInput = z.infer<typeof drawingSchema>;

export const drawingRevisionSchema = z.object({
  revision: req('Revision', 16),
  revisionDate: z.coerce.date(),
  changeDescription: req('Change Description', 400),
  status: z.enum(DRAWING_STATUS).default('Pending Approval'),
  ownerId: z.string().optional().nullable(),
});
export type DrawingRevisionInput = z.infer<typeof drawingRevisionSchema>;

export const drawingQuerySchema = listQuerySchema.extend({
  customerId: z.string().optional(),
  status: z.enum(DRAWING_STATUS).optional(),
  partId: z.string().optional(),
});

/* ------------------------ Pattern / Die / Tool ---------------------------- */
/** Base object kept separate so the PATCH schema can call `.partial()`. */
const toolFields = z.object({
  code: req('Tool Code', 32),
  type: z.enum(TOOL_TYPE),
  description: req('Description', 200),
  partId: z.string().optional().nullable(),
  material: opt(60),
  cavities: z.coerce.number().int().positive().max(64).default(1),
  /** Design shows a life-used bar: used/life -> %. */
  lifeShots: z.coerce.number().int().positive(),
  usedShots: z.coerce.number().int().nonnegative().default(0),
  location: opt(120),
  status: z.enum(TOOL_STATUS).default('Available'),
  revision: opt(16),
});

export const toolSchema = toolFields.refine((d) => d.usedShots <= d.lifeShots, {
  path: ['usedShots'], message: 'Shots used cannot exceed rated life',
});
export type ToolInput = z.infer<typeof toolSchema>;
export const toolUpdateSchema = toolFields.partial();

export const toolQuerySchema = listQuerySchema.extend({
  type: z.enum(TOOL_TYPE).optional(),
  status: z.enum(TOOL_STATUS).optional(),
  partId: z.string().optional(),
});

/* ------------------------ Customer Part Mapping --------------------------- */
export const partMappingSchema = z.object({
  customerId: req('Customer'),
  partId: req('Part'),
  customerPartNo: req('Customer Part No.', 80),
  drawingRef: opt(120),
  /** Stored in paise to avoid float drift; the UI formats as ₹ en-IN. */
  pricePaise: z.coerce.number().int().nonnegative().optional(),
  supplyCondition: z.enum(SUPPLY_CONDITION).optional(),
  status: z.enum(MAPPING_STATUS).default('Mapped'),
});
export type PartMappingInput = z.infer<typeof partMappingSchema>;
export const partMappingUpdateSchema = partMappingSchema.partial();

export const partMappingQuerySchema = listQuerySchema.extend({
  customerId: z.string().optional(),
  partId: z.string().optional(),
  status: z.enum(MAPPING_STATUS).optional(),
});
