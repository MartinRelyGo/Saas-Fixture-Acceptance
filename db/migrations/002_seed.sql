-- 002_seed.sql
-- Deterministic demo data for two unrelated tenants. Used by the tests to
-- prove that one tenant can never observe or mutate the other's rows.

INSERT INTO tenants (id, name) VALUES
  ('a', 'Acme Coffee'),
  ('b', 'Borealis Studio');

INSERT INTO members (id, tenant_id, email, role) VALUES
  ('m-a-owner', 'a', 'owner@acme.test', 'owner'),
  ('m-a-staff', 'a', 'staff@acme.test', 'staff'),
  ('m-b-owner', 'b', 'owner@borealis.test', 'owner'),
  ('m-b-staff', 'b', 'staff@borealis.test', 'staff');

INSERT INTO projects (id, tenant_id, name, archived) VALUES
  ('p-a-1', 'a', 'Spring menu', false),
  ('p-a-2', 'a', 'Loyalty cards', true),
  ('p-b-1', 'b', 'Brand refresh', false);
