-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'PROSPECT', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AlloyStatus" AS ENUM ('APPROVED', 'PENDING_APPROVAL', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "PartStatus" AS ENUM ('DEVELOPMENT', 'RELEASED', 'UNDER_REVISION', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "DrawingStatus" AS ENUM ('RELEASED', 'PENDING_APPROVAL', 'UNDER_REVISION', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ToolType" AS ENUM ('PATTERN', 'CORE_BOX', 'DIE', 'FIXTURE', 'GAUGE');

-- CreateEnum
CREATE TYPE "ToolStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE_DUE', 'UNDER_REPAIR', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "MappingStatus" AS ENUM ('MAPPED', 'UNDER_REVISION', 'OBSOLETE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "user_plants" (
    "userId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,

    CONSTRAINT "user_plants_pkey" PRIMARY KEY ("userId","plantId")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_series" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "suffix" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "industry" TEXT,
    "gstin" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'PROSPECT',
    "since" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alloys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "standard" TEXT,
    "equivalentGrades" TEXT,
    "status" "AlloyStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "tensileStrengthMpa" DECIMAL(8,2),
    "proofStressMpa" DECIMAL(8,2),
    "elongationPct" DECIMAL(5,2),
    "hardnessHb" TEXT,
    "pouringTempC" TEXT,
    "densityGCm3" DECIMAL(5,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alloys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chemistry_limits" (
    "id" TEXT NOT NULL,
    "alloyId" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "minPct" DECIMAL(6,3),
    "maxPct" DECIMAL(6,3),
    "remarks" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "chemistry_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanical_properties" (
    "id" TEXT NOT NULL,
    "alloyId" TEXT NOT NULL,
    "property" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "testMethod" TEXT,
    "testBar" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "mechanical_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_mix_items" (
    "id" TEXT NOT NULL,
    "alloyId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "qtyKg" DECIMAL(10,2) NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "charge_mix_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "customerId" TEXT NOT NULL,
    "customerPartNo" TEXT NOT NULL,
    "status" "PartStatus" NOT NULL DEFAULT 'DEVELOPMENT',
    "alloyId" TEXT NOT NULL,
    "castingProcess" TEXT,
    "heatTreatment" TEXT DEFAULT 'None',
    "toolId" TEXT,
    "cavitiesPerMould" INTEGER,
    "coresPerCasting" INTEGER,
    "castingWeightKg" DECIMAL(10,3) NOT NULL,
    "machinedWeightKg" DECIMAL(10,3),
    "pouredWeightKg" DECIMAL(10,3),
    "uom" TEXT NOT NULL DEFAULT 'Nos',
    "supplyCondition" TEXT,
    "drawingNo" TEXT,
    "currentRevision" TEXT,
    "customerSpec" TEXT,
    "generalTolerance" TEXT,
    "surfaceFinish" TEXT,
    "painting" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_characteristics" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "characteristic" TEXT NOT NULL,
    "specification" TEXT NOT NULL,
    "method" TEXT,
    "stage" TEXT,
    "frequency" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inspection_characteristics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "drawingNo" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drawings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing_revisions" (
    "id" TEXT NOT NULL,
    "drawingId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "revisionDate" TIMESTAMP(3) NOT NULL,
    "changeDescription" TEXT NOT NULL,
    "status" "DrawingStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "ownerId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawing_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tools" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ToolType" NOT NULL,
    "description" TEXT NOT NULL,
    "partId" TEXT,
    "material" TEXT,
    "cavities" INTEGER NOT NULL DEFAULT 1,
    "lifeShots" INTEGER NOT NULL,
    "usedShots" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "status" "ToolStatus" NOT NULL DEFAULT 'AVAILABLE',
    "revision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_mappings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "customerPartNo" TEXT NOT NULL,
    "drawingRef" TEXT,
    "pricePaise" BIGINT,
    "supplyCondition" TEXT,
    "status" "MappingStatus" NOT NULL DEFAULT 'MAPPED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "description" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "diff" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "plants_tenantId_idx" ON "plants"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "plants_tenantId_code_key" ON "plants"("tenantId", "code");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "roles_tenantId_idx" ON "roles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_name_key" ON "roles"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "number_series_tenantId_docType_key" ON "number_series"("tenantId", "docType");

-- CreateIndex
CREATE INDEX "customers_tenantId_name_idx" ON "customers"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenantId_code_key" ON "customers"("tenantId", "code");

-- CreateIndex
CREATE INDEX "customer_contacts_customerId_idx" ON "customer_contacts"("customerId");

-- CreateIndex
CREATE INDEX "alloys_tenantId_idx" ON "alloys"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "alloys_tenantId_code_key" ON "alloys"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "chemistry_limits_alloyId_element_key" ON "chemistry_limits"("alloyId", "element");

-- CreateIndex
CREATE INDEX "mechanical_properties_alloyId_idx" ON "mechanical_properties"("alloyId");

-- CreateIndex
CREATE INDEX "charge_mix_items_alloyId_idx" ON "charge_mix_items"("alloyId");

-- CreateIndex
CREATE INDEX "parts_tenantId_status_idx" ON "parts"("tenantId", "status");

-- CreateIndex
CREATE INDEX "parts_tenantId_name_idx" ON "parts"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "parts_tenantId_partNo_key" ON "parts"("tenantId", "partNo");

-- CreateIndex
CREATE UNIQUE INDEX "parts_tenantId_customerId_customerPartNo_key" ON "parts"("tenantId", "customerId", "customerPartNo");

-- CreateIndex
CREATE INDEX "inspection_characteristics_partId_idx" ON "inspection_characteristics"("partId");

-- CreateIndex
CREATE INDEX "drawings_tenantId_idx" ON "drawings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "drawings_tenantId_drawingNo_key" ON "drawings"("tenantId", "drawingNo");

-- CreateIndex
CREATE INDEX "drawing_revisions_drawingId_idx" ON "drawing_revisions"("drawingId");

-- CreateIndex
CREATE UNIQUE INDEX "drawing_revisions_drawingId_revision_key" ON "drawing_revisions"("drawingId", "revision");

-- CreateIndex
CREATE INDEX "tools_tenantId_status_idx" ON "tools"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tools_tenantId_code_key" ON "tools"("tenantId", "code");

-- CreateIndex
CREATE INDEX "part_mappings_tenantId_idx" ON "part_mappings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "part_mappings_tenantId_customerId_partId_key" ON "part_mappings"("tenantId", "customerId", "partId");

-- CreateIndex
CREATE INDEX "attachments_tenantId_entityType_entityId_idx" ON "attachments"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entityType_entityId_idx" ON "audit_logs"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plants" ADD CONSTRAINT "user_plants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plants" ADD CONSTRAINT "user_plants_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_series" ADD CONSTRAINT "number_series_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alloys" ADD CONSTRAINT "alloys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chemistry_limits" ADD CONSTRAINT "chemistry_limits_alloyId_fkey" FOREIGN KEY ("alloyId") REFERENCES "alloys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanical_properties" ADD CONSTRAINT "mechanical_properties_alloyId_fkey" FOREIGN KEY ("alloyId") REFERENCES "alloys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_mix_items" ADD CONSTRAINT "charge_mix_items_alloyId_fkey" FOREIGN KEY ("alloyId") REFERENCES "alloys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_alloyId_fkey" FOREIGN KEY ("alloyId") REFERENCES "alloys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_characteristics" ADD CONSTRAINT "inspection_characteristics_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_revisions" ADD CONSTRAINT "drawing_revisions_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "drawings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_revisions" ADD CONSTRAINT "drawing_revisions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tools" ADD CONSTRAINT "tools_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tools" ADD CONSTRAINT "tools_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_mappings" ADD CONSTRAINT "part_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_mappings" ADD CONSTRAINT "part_mappings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_mappings" ADD CONSTRAINT "part_mappings_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
