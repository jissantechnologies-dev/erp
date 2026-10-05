/**
 * Seeds the "Indus Foundries" demo workspace with the exact sample data from
 * mockups/indus-foundries-erp-design.html, so a fresh install renders the
 * screens the design shows rather than empty states.
 *
 * Idempotent: re-running updates in place instead of duplicating.
 *   npm run db:seed -w @erp/api
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { SYSTEM_ROLES } from '@erp/shared';

const prisma = new PrismaClient();

const SLUG = 'indus-foundries';
const DEMO_PASSWORD = 'IndusDemo2026!';

/** "05-Oct-2026" -> Date. The design writes every date this way. */
const d = (s: string): Date => {
  const [day, mon, year] = s.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return new Date(Date.UTC(Number(year), months.indexOf(mon), Number(day)));
};

/** "₹ 2,850" -> 285000 paise. */
const paise = (rupeeText: string): bigint =>
  BigInt(Math.round(Number(rupeeText.replace(/[^\d.]/g, '')) * 100));

const NUMBER_SERIES = [
  { docType: 'part', prefix: 'IF-', padding: 4, nextValue: 9 },
  { docType: 'customer', prefix: 'CUS-', padding: 4, nextValue: 9 },
  { docType: 'enquiry', prefix: 'ENQ-', padding: 4, nextValue: 9 },
  { docType: 'feasibility', prefix: 'FS-', padding: 4, nextValue: 42 },
  { docType: 'quotation', prefix: 'QT-', padding: 4, nextValue: 119 },
  { docType: 'salesOrder', prefix: 'SO-', padding: 4, nextValue: 343 },
  { docType: 'tool', prefix: 'PAT-', padding: 4, nextValue: 122 },
  { docType: 'heat', prefix: 'H-', padding: 4, nextValue: 1043 },
  { docType: 'grn', prefix: 'GRN-', padding: 4, nextValue: 935 },
];

const CUSTOMERS = [
  { code: 'CUS-0001', name: 'ABC Engineering Pvt. Ltd.', city: 'Chennai', state: 'Tamil Nadu', industry: 'Industrial Pumps', status: 'ACTIVE', since: 'Mar 2019', contact: { name: 'R. Karthikeyan', designation: 'Purchase Manager', phone: '+91 98400 12345', email: 'karthik@abceng.in' } },
  { code: 'CUS-0002', name: 'Aqua Flow Pumps Ltd.', city: 'Coimbatore', state: 'Tamil Nadu', industry: 'Agricultural Pumps', status: 'ACTIVE', since: 'Jul 2020', contact: { name: 'S. Priya', designation: 'Sourcing Lead', phone: '+91 94433 67890', email: 'priya.s@aquaflow.co.in' } },
  { code: 'CUS-0003', name: 'Deccan Pumps Pvt. Ltd.', city: 'Hyderabad', state: 'Telangana', industry: 'Process Pumps', status: 'ACTIVE', since: 'Jan 2021', contact: { name: 'V. Ramesh Reddy', designation: 'VP – Supply Chain', phone: '+91 99490 22118', email: 'ramesh@deccanpumps.com' } },
  { code: 'CUS-0004', name: 'Sakthi Valves & Controls', city: 'Coimbatore', state: 'Tamil Nadu', industry: 'Valves', status: 'ACTIVE', since: 'Nov 2021', contact: { name: 'M. Senthil Kumar', designation: 'Buyer', phone: '+91 97890 45512', email: 'senthil@sakthivalves.in' } },
  { code: 'CUS-0005', name: 'Bharat Hydraulics Pvt. Ltd.', city: 'Pune', state: 'Maharashtra', industry: 'Hydraulics', status: 'ACTIVE', since: 'Apr 2022', contact: { name: 'A. Kulkarni', designation: 'Purchase Head', phone: '+91 98220 77341', email: 'akulkarni@bharathyd.com' } },
  { code: 'CUS-0006', name: 'Vega Compressors Ltd.', city: 'Bengaluru', state: 'Karnataka', industry: 'Compressors', status: 'PROSPECT', since: 'Aug 2026', contact: { name: 'N. Shwetha', designation: 'Category Manager', phone: '+91 99000 31876', email: 'shwetha.n@vegacomp.in' } },
  { code: 'CUS-0007', name: 'Southern Agro Machinery', city: 'Madurai', state: 'Tamil Nadu', industry: 'Agri Equipment', status: 'INACTIVE', since: 'Feb 2018', contact: { name: 'P. Muthu', designation: 'Proprietor', phone: '+91 94431 90022', email: 'muthu@southernagro.in' } },
  { code: 'CUS-0008', name: 'Shree Motor Components', city: 'Rajkot', state: 'Gujarat', industry: 'Automotive', status: 'ACTIVE', since: 'Sep 2023', contact: { name: 'H. Patel', designation: 'Purchase Executive', phone: '+91 98250 66410', email: 'hpatel@shreemotor.co.in' } },
] as const;

const ALLOYS = [
  { code: 'FG220', name: 'Grey Cast Iron FG220', family: 'Cast Iron', standard: 'IS 210', tensile: 220, hardness: '180–220', status: 'APPROVED' },
  { code: 'FG260', name: 'Grey Cast Iron FG260', family: 'Cast Iron', standard: 'IS 210', tensile: 260, hardness: '190–240', status: 'APPROVED' },
  { code: 'SG450', name: 'SG Iron 450/10', family: 'SG Iron', standard: 'IS 1865', tensile: 450, hardness: '160–210', status: 'APPROVED' },
  { code: 'SG500', name: 'SG Iron 500/7', family: 'SG Iron', standard: 'IS 1865', tensile: 500, hardness: '170–230', status: 'APPROVED' },
  { code: 'WCB', name: 'Carbon Steel WCB', family: 'Carbon Steel', standard: 'ASTM A216', tensile: 485, hardness: '≤ 187', status: 'APPROVED' },
  { code: 'CF8M', name: 'Stainless CF8M', family: 'Alloy Steel', standard: 'ASTM A351', tensile: 485, hardness: '≤ 190', status: 'APPROVED' },
  { code: 'LCC', name: 'Low-temp Carbon Steel LCC', family: 'Alloy Steel', standard: 'ASTM A352', tensile: 485, hardness: '≤ 197', status: 'PENDING_APPROVAL' },
] as const;

/** SG500 chemistry from the design's CHEM constant. */
const SG500_CHEMISTRY = [
  { element: 'C', min: 3.40, max: 3.80, remarks: null },
  { element: 'Si', min: 2.20, max: 2.80, remarks: null },
  { element: 'Mn', min: null, max: 0.40, remarks: null },
  { element: 'P', min: null, max: 0.05, remarks: null },
  { element: 'S', min: null, max: 0.02, remarks: null },
  { element: 'Mg', min: 0.030, max: 0.060, remarks: 'Residual after treatment' },
  { element: 'Cu', min: 0.30, max: 0.60, remarks: 'Pearlite promoter' },
];

const SG500_MECHANICAL = [
  { property: 'Tensile strength', requirement: '≥ 500 MPa', testMethod: 'IS 1608', testBar: 'Y-block 25 mm' },
  { property: '0.2% proof stress', requirement: '≥ 320 MPa', testMethod: 'IS 1608', testBar: 'Y-block 25 mm' },
  { property: 'Elongation', requirement: '≥ 7 %', testMethod: 'IS 1608', testBar: 'Y-block 25 mm' },
  { property: 'Hardness', requirement: '170 – 230 HB', testMethod: 'IS 1500', testBar: 'On casting' },
  { property: 'Nodularity', requirement: '≥ 85 %', testMethod: 'IS 7754', testBar: 'Microsection' },
];

const SG500_CHARGE_MIX = [
  { input: 'Pig iron (low Mn)', qtyKg: 450 },
  { input: 'Steel scrap (CRCA)', qtyKg: 250 },
  { input: 'Foundry returns (SG)', qtyKg: 280 },
  { input: 'FeSi 75', qtyKg: 12 },
  { input: 'FeSiMg (treatment)', qtyKg: 14 },
  { input: 'Inoculant', qtyKg: 3 },
];

const PARTS = [
  { partNo: 'IF-PH-4410', name: 'Pump Housing', customer: 'CUS-0001', customerPartNo: 'ABC-PH-4410', alloy: 'SG500', cw: 18.5, mw: 15.2, drawingNo: 'ABC-DRG-4410', rev: 'C', process: 'Green sand', status: 'RELEASED', tool: 'PAT-0112' },
  { partNo: 'IF-VB-212', name: 'Valve Body', customer: 'CUS-0002', customerPartNo: 'AFP-VB-212', alloy: 'FG260', cw: 9.8, mw: 8.1, drawingNo: 'AFP-DRG-212', rev: 'B', process: 'Green sand', status: 'DEVELOPMENT', tool: 'PAT-0118' },
  { partNo: 'IF-IMP-150', name: 'Impeller', customer: 'CUS-0003', customerPartNo: 'DP-IMP-150', alloy: 'CF8M', cw: 4.2, mw: 3.6, drawingNo: 'DP-DRG-150', rev: 'D', process: 'Investment', status: 'RELEASED', tool: 'DIE-0031' },
  { partNo: 'IF-BH-08', name: 'Bearing Housing', customer: 'CUS-0004', customerPartNo: 'SVC-BH-08', alloy: 'FG260', cw: 6.4, mw: 5.3, drawingNo: 'SVC-DRG-08', rev: 'A', process: 'Green sand', status: 'RELEASED', tool: 'PAT-0105' },
  { partNo: 'IF-MB-330', name: 'Manifold Block', customer: 'CUS-0005', customerPartNo: 'BH-MB-330', alloy: 'SG450', cw: 22.0, mw: 17.9, drawingNo: 'BH-DRG-330', rev: 'B', process: 'No-bake', status: 'UNDER_REVISION', tool: 'PAT-0121' },
  { partNo: 'IF-PC-400', name: 'Pump Casing 4"', customer: 'CUS-0002', customerPartNo: 'AFP-PC-400', alloy: 'FG260', cw: 14.6, mw: 12.2, drawingNo: 'AFP-DRG-400', rev: 'B', process: 'Green sand', status: 'RELEASED', tool: 'PAT-0098' },
  { partNo: 'IF-GC-17', name: 'Gearbox Cover', customer: 'CUS-0008', customerPartNo: 'SMC-GC-17', alloy: 'FG220', cw: 3.1, mw: 2.7, drawingNo: 'SMC-DRG-17', rev: 'A', process: 'Green sand', status: 'OBSOLETE', tool: 'PAT-0071' },
  { partNo: 'IF-VC-90', name: 'Volute Casing', customer: 'CUS-0003', customerPartNo: 'DP-VC-90', alloy: 'WCB', cw: 28.4, mw: 24.0, drawingNo: 'DP-DRG-90', rev: 'C', process: 'No-bake', status: 'RELEASED', tool: 'PAT-0109' },
] as const;

/** Inspection characteristics from the Part detail's Specifications tab. */
const PH_CHARACTERISTICS = [
  { characteristic: 'Chemical – C %', specification: '3.40 – 3.80', method: 'Spectro', stage: 'Melting', frequency: 'Every heat' },
  { characteristic: 'Chemical – Mg %', specification: '0.030 – 0.060', method: 'Spectro', stage: 'Melting', frequency: 'Every heat' },
  { characteristic: 'Tensile strength', specification: '≥ 500 MPa', method: 'UTM', stage: 'Final', frequency: 'Per heat' },
  { characteristic: 'Hardness', specification: '170 – 230 HB', method: 'Brinell', stage: 'Final', frequency: '5 per lot' },
  { characteristic: 'Nodularity', specification: '≥ 85 %', method: 'Microscope', stage: 'Final', frequency: 'Per heat' },
  { characteristic: 'Bore Ø120', specification: '120.000 – 120.035', method: 'Bore gauge', stage: 'Machining', frequency: '100 %' },
  { characteristic: 'Pressure test', specification: '10 bar, 2 min, no leak', method: 'Hydro rig', stage: 'Final', frequency: '100 %' },
];

const TOOLS = [
  { code: 'PAT-0112', type: 'PATTERN', description: 'Pump Housing – 2 cavity match plate', part: 'IF-PH-4410', material: 'Aluminium', cavities: 2, lifeShots: 30000, usedShots: 4200, location: 'Pattern Store · Rack B-04', status: 'IN_USE', revision: 'C' },
  { code: 'PAT-0098', type: 'PATTERN', description: 'Pump Casing 4" – cope & drag', part: 'IF-PC-400', material: 'Aluminium', cavities: 1, lifeShots: 25000, usedShots: 21800, location: 'Moulding Line 2', status: 'MAINTENANCE_DUE', revision: 'B' },
  { code: 'PAT-0105', type: 'PATTERN', description: 'Bearing Housing – 4 cavity', part: 'IF-BH-08', material: 'Cast Iron', cavities: 4, lifeShots: 50000, usedShots: 12600, location: 'Pattern Store · Rack A-11', status: 'AVAILABLE', revision: 'A' },
  { code: 'CB-0044', type: 'CORE_BOX', description: 'Pump Housing main core', part: 'IF-PH-4410', material: 'Resin', cavities: 1, lifeShots: 15000, usedShots: 4100, location: 'Core Shop', status: 'IN_USE', revision: 'C' },
  { code: 'DIE-0031', type: 'DIE', description: 'Impeller wax die', part: 'IF-IMP-150', material: 'Tool Steel H13', cavities: 2, lifeShots: 80000, usedShots: 31200, location: 'Investment Shop', status: 'AVAILABLE', revision: 'D' },
  { code: 'PAT-0121', type: 'PATTERN', description: 'Manifold Block – no-bake', part: 'IF-MB-330', material: 'Wood + Resin', cavities: 1, lifeShots: 5000, usedShots: 950, location: 'Pattern Shop (modification)', status: 'UNDER_REPAIR', revision: 'B' },
  { code: 'FX-0017', type: 'FIXTURE', description: 'VMC fixture – Pump Housing bore', part: 'IF-PH-4410', material: 'Steel', cavities: 1, lifeShots: 100000, usedShots: 3800, location: 'Machining · VMC-3', status: 'IN_USE', revision: 'C' },
  { code: 'PAT-0071', type: 'PATTERN', description: 'Gearbox Cover – 6 cavity', part: 'IF-GC-17', material: 'Aluminium', cavities: 6, lifeShots: 40000, usedShots: 40000, location: 'Scrap Yard', status: 'SCRAPPED', revision: 'A' },
  // Referenced by IF-VB-212 and IF-VC-90 in the design's PARTS array but absent
  // from its TOOLS array; added so every part's pattern link resolves.
  { code: 'PAT-0118', type: 'PATTERN', description: 'Valve Body – 2 cavity', part: 'IF-VB-212', material: 'Aluminium', cavities: 2, lifeShots: 30000, usedShots: 1200, location: 'Pattern Store · Rack B-07', status: 'IN_USE', revision: 'B' },
  { code: 'PAT-0109', type: 'PATTERN', description: 'Volute Casing – no-bake', part: 'IF-VC-90', material: 'Wood + Resin', cavities: 1, lifeShots: 8000, usedShots: 2400, location: 'Pattern Store · Rack C-02', status: 'IN_USE', revision: 'C' },
] as const;

const DRAWINGS = [
  { drawingNo: 'ABC-DRG-4410', part: 'IF-PH-4410', customer: 'CUS-0001', revisions: [
    { revision: 'C', date: '05-Oct-2026', change: 'Boss added on flange side', status: 'PENDING_APPROVAL', owner: 'Ganesh P.' },
    { revision: 'B', date: '12-Mar-2026', change: 'Wall thickness 5 → 4.5 mm', status: 'SUPERSEDED', owner: 'Lakshmi N.' },
    { revision: 'A', date: '20-Jan-2025', change: 'First issue', status: 'SUPERSEDED', owner: 'Ganesh P.' },
  ] },
  { drawingNo: 'BH-DRG-330', part: 'IF-MB-330', customer: 'CUS-0005', revisions: [
    { revision: 'B', date: '29-Sep-2026', change: 'Port Ø18 changed to Ø20', status: 'UNDER_REVISION', owner: 'Lakshmi N.' },
    { revision: 'A', date: '15-Feb-2026', change: 'First issue', status: 'SUPERSEDED', owner: 'Ganesh P.' },
  ] },
  { drawingNo: 'DP-DRG-150', part: 'IF-IMP-150', customer: 'CUS-0003', revisions: [
    { revision: 'D', date: '14-Sep-2026', change: 'Vane thickness 4 → 4.5 mm', status: 'RELEASED', owner: 'Ganesh P.' },
  ] },
  { drawingNo: 'AFP-DRG-212', part: 'IF-VB-212', customer: 'CUS-0002', revisions: [
    { revision: 'B', date: '02-Sep-2026', change: 'Machining allowance updated', status: 'RELEASED', owner: 'Lakshmi N.' },
  ] },
  { drawingNo: 'DP-DRG-90', part: 'IF-VC-90', customer: 'CUS-0003', revisions: [
    { revision: 'C', date: '18-Aug-2026', change: 'Tolerance on Ø210 bore tightened', status: 'RELEASED', owner: 'Ganesh P.' },
  ] },
  { drawingNo: 'AFP-DRG-400', part: 'IF-PC-400', customer: 'CUS-0002', revisions: [
    { revision: 'B', date: '10-Jul-2026', change: 'Logo emboss position moved', status: 'RELEASED', owner: 'Lakshmi N.' },
  ] },
  { drawingNo: 'SVC-DRG-08', part: 'IF-BH-08', customer: 'CUS-0004', revisions: [
    { revision: 'A', date: '05-Nov-2021', change: 'First issue', status: 'RELEASED', owner: 'Ganesh P.' },
  ] },
  { drawingNo: 'SMC-DRG-17', part: 'IF-GC-17', customer: 'CUS-0008', revisions: [
    { revision: 'A', date: '12-Sep-2023', change: 'First issue', status: 'SUPERSEDED', owner: 'Lakshmi N.' },
  ] },
] as const;

const MAPPINGS = [
  { customer: 'CUS-0001', part: 'IF-PH-4410', customerPartNo: 'ABC-PH-4410', drawingRef: 'ABC-DRG-4410 · C', price: '₹ 2,850', supply: 'Fully machined', status: 'MAPPED' },
  { customer: 'CUS-0002', part: 'IF-VB-212', customerPartNo: 'AFP-VB-212', drawingRef: 'AFP-DRG-212 · B', price: '₹ 1,240', supply: 'Rough machined', status: 'MAPPED' },
  { customer: 'CUS-0002', part: 'IF-PC-400', customerPartNo: 'AFP-PC-400', drawingRef: 'AFP-DRG-400 · B', price: '₹ 1,800', supply: 'Fully machined', status: 'MAPPED' },
  { customer: 'CUS-0003', part: 'IF-IMP-150', customerPartNo: 'DP-IMP-150', drawingRef: 'DP-DRG-150 · D', price: '₹ 2,880', supply: 'Fully machined', status: 'MAPPED' },
  { customer: 'CUS-0003', part: 'IF-VC-90', customerPartNo: 'DP-VC-90', drawingRef: 'DP-DRG-90 · C', price: '₹ 4,400', supply: 'Machined & painted', status: 'MAPPED' },
  { customer: 'CUS-0004', part: 'IF-BH-08', customerPartNo: 'SVC-BH-08', drawingRef: 'SVC-DRG-08 · A', price: '₹ 1,530', supply: 'As cast', status: 'MAPPED' },
  { customer: 'CUS-0005', part: 'IF-MB-330', customerPartNo: 'BH-MB-330', drawingRef: 'BH-DRG-330 · B', price: '₹ 4,200', supply: 'Fully machined', status: 'UNDER_REVISION' },
  { customer: 'CUS-0008', part: 'IF-GC-17', customerPartNo: 'SMC-GC-17', drawingRef: 'SMC-DRG-17 · A', price: '₹ 600', supply: 'As cast', status: 'OBSOLETE' },
] as const;

/** Staff named in the design's owner/reviewer columns. */
const STAFF = [
  { email: 'arun@indusfoundries.in', fullName: 'Arun Vasudevan', displayName: 'Arun V.', role: 'sales' },
  { email: 'divya@indusfoundries.in', fullName: 'Divya Ramachandran', displayName: 'Divya R.', role: 'sales' },
  { email: 'karthik@indusfoundries.in', fullName: 'Karthik Subramanian', displayName: 'Karthik S.', role: 'sales' },
  { email: 'ganesh@indusfoundries.in', fullName: 'Ganesh Prabhu', displayName: 'Ganesh P.', role: 'methods' },
  { email: 'lakshmi@indusfoundries.in', fullName: 'Lakshmi Narayanan', displayName: 'Lakshmi N.', role: 'methods' },
] as const;

async function main(): Promise<void> {
  console.log('Seeding Indus Foundries demo workspace…');

  /* ------------------------------- Tenant -------------------------------- */
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: { name: 'Indus Foundries' },
    create: { slug: SLUG, name: 'Indus Foundries', status: 'ACTIVE' },
  });
  const tenantId = tenant.id;

  /* -------------------------------- Roles -------------------------------- */
  for (const [key, r] of Object.entries(SYSTEM_ROLES)) {
    await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: r.name } },
      update: { permissions: r.permissions as string[], description: r.description, key },
      create: {
        tenantId, key, name: r.name, description: r.description,
        permissions: r.permissions as string[], isSystem: true,
      },
    });
  }
  const roleByKey = new Map(
    (await prisma.role.findMany({ where: { tenantId } })).map((r) => [r.key ?? r.name, r]),
  );

  /* -------------------------------- Plant -------------------------------- */
  const plant = await prisma.plant.upsert({
    where: { tenantId_code: { tenantId, code: 'MAIN' } },
    update: {},
    create: {
      tenantId, code: 'MAIN', name: 'Indus Foundries — Coimbatore Works',
      city: 'Coimbatore', state: 'Tamil Nadu', isDefault: true,
    },
  });

  /* --------------------------- Number series ----------------------------- */
  for (const s of NUMBER_SERIES) {
    await prisma.numberSeries.upsert({
      where: { tenantId_docType: { tenantId, docType: s.docType } },
      update: { prefix: s.prefix, padding: s.padding },
      create: { tenantId, ...s },
    });
  }

  /* -------------------------------- Users -------------------------------- */
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: 'admin@indusfoundries.in' } },
    update: {},
    create: {
      tenantId, email: 'admin@indusfoundries.in', fullName: 'Indus Administrator',
      displayName: 'Admin', passwordHash,
      roles: { create: { roleId: roleByKey.get('owner')!.id } },
      plants: { create: { plantId: plant.id } },
    },
  });

  const userByName = new Map<string, string>([['Admin', owner.id]]);
  for (const s of STAFF) {
    const u = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: s.email } },
      update: { displayName: s.displayName },
      create: {
        tenantId, email: s.email, fullName: s.fullName, displayName: s.displayName,
        passwordHash,
        roles: { create: { roleId: roleByKey.get(s.role)!.id } },
        plants: { create: { plantId: plant.id } },
      },
    });
    userByName.set(s.displayName, u.id);
  }

  /* ------------------------------ Customers ------------------------------ */
  const customerByCode = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const existing = await prisma.customer.findUnique({
      where: { tenantId_code: { tenantId, code: c.code } },
    });
    const [mon, yr] = c.since.split(' ');
    const since = d(`01-${mon}-${yr}`);

    const customer = existing
      ? await prisma.customer.update({
          where: { id: existing.id },
          data: { name: c.name, city: c.city, state: c.state, industry: c.industry, status: c.status as never, since },
        })
      : await prisma.customer.create({
          data: {
            tenantId, code: c.code, name: c.name, city: c.city, state: c.state,
            industry: c.industry, status: c.status as never, since,
            contacts: { create: { ...c.contact, isPrimary: true } },
          },
        });
    customerByCode.set(c.code, customer.id);
  }

  /* -------------------------------- Alloys ------------------------------- */
  const alloyByCode = new Map<string, string>();
  for (const a of ALLOYS) {
    const alloy = await prisma.alloy.upsert({
      where: { tenantId_code: { tenantId, code: a.code } },
      update: { name: a.name, family: a.family, standard: a.standard, status: a.status as never },
      create: {
        tenantId, code: a.code, name: a.name, family: a.family, standard: a.standard,
        status: a.status as never,
        tensileStrengthMpa: a.tensile, hardnessHb: a.hardness,
        densityGCm3: a.family.includes('Iron') ? 7.1 : 7.85,
        pouringTempC: a.family === 'SG Iron' ? '1,380 – 1,420' : null,
      },
    });
    alloyByCode.set(a.code, alloy.id);
  }

  // SG500 gets the full chemistry/mechanical/charge detail the design shows.
  const sg500 = alloyByCode.get('SG500')!;
  await prisma.chemistryLimit.deleteMany({ where: { alloyId: sg500 } });
  await prisma.chemistryLimit.createMany({
    data: SG500_CHEMISTRY.map((c, i) => ({
      alloyId: sg500, element: c.element, minPct: c.min, maxPct: c.max,
      remarks: c.remarks, sequence: i,
    })),
  });
  await prisma.mechanicalProperty.deleteMany({ where: { alloyId: sg500 } });
  await prisma.mechanicalProperty.createMany({
    data: SG500_MECHANICAL.map((m, i) => ({ alloyId: sg500, ...m, sequence: i })),
  });
  await prisma.chargeMixItem.deleteMany({ where: { alloyId: sg500 } });
  await prisma.chargeMixItem.createMany({
    data: SG500_CHARGE_MIX.map((m, i) => ({ alloyId: sg500, ...m, sequence: i })),
  });

  /* --------------------------------- Parts ------------------------------- */
  // Parts are created before tools, then linked: Part.toolId and Tool.partId
  // reference each other, so one side must be filled in a second pass.
  const partByNo = new Map<string, string>();
  for (const p of PARTS) {
    const data = {
      name: p.name,
      customerId: customerByCode.get(p.customer)!,
      customerPartNo: p.customerPartNo,
      alloyId: alloyByCode.get(p.alloy)!,
      status: p.status as never,
      castingProcess: p.process,
      heatTreatment: 'Stress relieving',
      cavitiesPerMould: 2,
      coresPerCasting: 2,
      castingWeightKg: p.cw,
      machinedWeightKg: p.mw,
      // The design derives poured weight as casting x 1.45 (gating + risers).
      pouredWeightKg: Number((p.cw * 1.45).toFixed(2)),
      uom: 'Nos',
      supplyCondition: 'Fully machined',
      drawingNo: p.drawingNo,
      currentRevision: `Rev ${p.rev}`,
      customerSpec: p.alloy === 'SG500' ? 'IS 1865 Gr 500/7, pressure test 10 bar' : null,
      generalTolerance: 'ISO 8062 CT9',
      surfaceFinish: 'Ra 3.2 on machined faces',
      painting: 'Red oxide primer',
      category: 'Pump components',
    } satisfies Partial<Prisma.PartUncheckedCreateInput>;

    const part = await prisma.part.upsert({
      where: { tenantId_partNo: { tenantId, partNo: p.partNo } },
      update: data,
      create: { tenantId, partNo: p.partNo, ...data },
    });
    partByNo.set(p.partNo, part.id);
  }

  // Inspection characteristics for the Pump Housing (the design's example).
  const ph = partByNo.get('IF-PH-4410')!;
  await prisma.inspectionCharacteristic.deleteMany({ where: { partId: ph } });
  await prisma.inspectionCharacteristic.createMany({
    data: PH_CHARACTERISTICS.map((c, i) => ({ partId: ph, ...c, sequence: i })),
  });

  /* --------------------------------- Tools ------------------------------- */
  const toolByCode = new Map<string, string>();
  for (const t of TOOLS) {
    const data = {
      type: t.type as never,
      description: t.description,
      partId: partByNo.get(t.part) ?? null,
      material: t.material,
      cavities: t.cavities,
      lifeShots: t.lifeShots,
      usedShots: t.usedShots,
      location: t.location,
      status: t.status as never,
      revision: t.revision,
    };
    const tool = await prisma.tool.upsert({
      where: { tenantId_code: { tenantId, code: t.code } },
      update: data,
      create: { tenantId, code: t.code, ...data },
    });
    toolByCode.set(t.code, tool.id);
  }

  // Second pass: point each part at its primary pattern/die.
  for (const p of PARTS) {
    const toolId = toolByCode.get(p.tool);
    if (toolId) {
      await prisma.part.update({ where: { id: partByNo.get(p.partNo)! }, data: { toolId } });
    }
  }

  /* -------------------------------- Drawings ----------------------------- */
  for (const dr of DRAWINGS) {
    const drawing = await prisma.drawing.upsert({
      where: { tenantId_drawingNo: { tenantId, drawingNo: dr.drawingNo } },
      update: {},
      create: {
        tenantId, drawingNo: dr.drawingNo,
        partId: partByNo.get(dr.part)!,
        customerId: customerByCode.get(dr.customer)!,
      },
    });
    for (const r of dr.revisions) {
      await prisma.drawingRevision.upsert({
        where: { drawingId_revision: { drawingId: drawing.id, revision: r.revision } },
        update: { status: r.status as never, changeDescription: r.change },
        create: {
          drawingId: drawing.id,
          revision: r.revision,
          revisionDate: d(r.date),
          changeDescription: r.change,
          status: r.status as never,
          ownerId: userByName.get(r.owner) ?? null,
          approvedAt: r.status === 'RELEASED' ? d(r.date) : null,
        },
      });
    }
  }

  /* ------------------------------- Mappings ------------------------------ */
  for (const m of MAPPINGS) {
    const customerId = customerByCode.get(m.customer)!;
    const partId = partByNo.get(m.part)!;
    const data = {
      customerPartNo: m.customerPartNo,
      drawingRef: m.drawingRef,
      pricePaise: paise(m.price),
      supplyCondition: m.supply,
      status: m.status as never,
    };
    await prisma.partMapping.upsert({
      where: { tenantId_customerId_partId: { tenantId, customerId, partId } },
      update: data,
      create: { tenantId, customerId, partId, ...data },
    });
  }

  console.log(`
Seed complete.

  Workspace   ${tenant.name}  (slug: ${SLUG})
  Sign in     admin@indusfoundries.in
  Password    ${DEMO_PASSWORD}

  Also seeded: ${STAFF.length} staff users (same password),
  ${CUSTOMERS.length} customers, ${ALLOYS.length} grades, ${PARTS.length} parts,
  ${TOOLS.length} tools, ${DRAWINGS.length} drawings, ${MAPPINGS.length} mappings.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
