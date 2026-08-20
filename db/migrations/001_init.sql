-- 001_init.sql
-- Multi-tenant SaaS schema for the disposable acceptance fixture.
--
-- SECURITY MODEL (do not weaken):
--   * Every tenant-scoped table has RLS ENABLED and FORCED.
--   * The application connects as the non-privileged role `app_user`.
--   * Tenancy comes from the session setting `app.tenant_id`, which is set
--     by the server from the auth token only -- never from client input.
--   * Privileged actions additionally require `app.role = 'owner'`.

CREATE ROLE app_user NOLOGIN;

CREATE TABLE tenants (
  id   text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE members (
  id        text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email     text NOT NULL,
  role      text NOT NULL CHECK (role IN ('owner', 'staff'))
);

CREATE TABLE projects (
  id         text PRIMARY KEY,
  tenant_id  text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  archived   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_tenant_idx ON projects (tenant_id);
CREATE INDEX members_tenant_idx ON members (tenant_id);

GRANT SELECT ON tenants TO app_user;
GRANT SELECT ON members TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO app_user;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE members FORCE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

CREATE POLICY tenants_self ON tenants
  FOR SELECT TO app_user
  USING (id = current_setting('app.tenant_id', true));

CREATE POLICY members_same_tenant ON members
  FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY projects_read ON projects
  FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY projects_insert ON projects
  FOR INSERT TO app_user
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY projects_update ON projects
  FOR UPDATE TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Deleting a project is an owner-only action, enforced in the database as
-- well as in the application layer.
CREATE POLICY projects_delete_owner ON projects
  FOR DELETE TO app_user
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    AND current_setting('app.role', true) = 'owner'
  );
