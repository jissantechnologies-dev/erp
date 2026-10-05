-- Row-level security backstop.
--
-- The Prisma client extension in src/prisma/prisma.service.ts is the primary
-- tenant guard. This file is the second line of defence: if a raw query, a
-- migration script or a future bug bypasses the extension, Postgres still
-- refuses to return another tenant's rows.
--
-- Policies read `app.current_tenant`, set per transaction by
-- PrismaService.withRlsTenant(). When the setting is absent (migrations, seed,
-- admin tasks) the policy denies everything, so those paths must run as a role
-- with BYPASSRLS or as the table owner.
--
-- Apply with:  psql "$DATABASE_URL" -f prisma/rls.sql
-- Re-run it after any migration that adds a tenant-owned table.
--
-- IMPORTANT — these policies are INERT until the app connects as a
-- non-superuser. Postgres superusers bypass RLS entirely, even with FORCE, and
-- the `erp` role created by the postgres Docker image IS a superuser. So in the
-- default dev setup the Prisma client extension is the only active tenant
-- guard. Verified behaviour for a non-superuser role:
--
--   no app.current_tenant set   -> 0 rows
--   app.current_tenant = <id>   -> only that tenant's rows
--
-- To actually switch RLS on, create the unprivileged role at the bottom of this
-- file, point DATABASE_URL at it, and route queries through
-- PrismaService.withRlsTenant() so the session variable is set per
-- transaction. Keep migrations and the seed on the owner role, which
-- legitimately writes across tenants.

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'plants', 'users', 'roles', 'number_series', 'customers', 'alloys',
    'parts', 'drawings', 'tools', 'part_mappings', 'attachments', 'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- Enable and force RLS so even the table owner is subject to it.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING ("tenantId" = current_setting('app.current_tenant', true))
        WITH CHECK ("tenantId" = current_setting('app.current_tenant', true))
    $f$, t);
  END LOOP;
END $$;

-- The unprivileged role the application should connect as in production, so
-- that the policies above actually bind. Uncomment, set a real password, and
-- point DATABASE_URL at it.
--
--   CREATE ROLE erp_app LOGIN PASSWORD 'replace-me' NOSUPERUSER NOBYPASSRLS;
--   GRANT USAGE ON SCHEMA public TO erp_app;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app;
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_app;
--   -- so future migrations' tables are covered without re-granting:
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO erp_app;
--
-- Confirm the role is genuinely subject to RLS:
--   SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'erp_app';
-- Both flags must be false.
