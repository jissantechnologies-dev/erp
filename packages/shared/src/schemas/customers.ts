import { z } from 'zod';
import { req, opt, listQuerySchema } from './common.js';
import { CUSTOMER_STATUS } from '../enums.js';

/**
 * Transcribed from the design's Add Customer form. Lives in @erp/shared (not
 * in the API service) so the web form and the API validate identically.
 */
export const customerContactSchema = z.object({
  name: req('Contact Person'),
  designation: opt(80),
  phone: opt(32),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
});

export const customerSchema = z.object({
  name: req('Customer Name'),
  city: opt(80),
  state: opt(80),
  industry: opt(80),
  /** 15-character GSTIN; optional because prospects often have none on file. */
  gstin: z.string().trim().toUpperCase()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
      'Enter a valid 15-character GSTIN',
    )
    .optional()
    .or(z.literal('')),
  status: z.enum(CUSTOMER_STATUS).default('Prospect'),
  contact: customerContactSchema.optional(),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const customerUpdateSchema = customerSchema.partial();

export const customerQuerySchema = listQuerySchema.extend({
  status: z.enum(CUSTOMER_STATUS).optional(),
  state: z.string().optional(),
});
