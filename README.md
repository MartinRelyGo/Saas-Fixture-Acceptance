# Ledgerly — disposable database-backed SaaS fixture

A deliberately tiny multi-tenant SaaS app used **only** as an acceptance
fixture for the AI Builder execution plane. Nothing here is production code.

- Real Postgres in-process (PGlite) with SQL migrations in `db/migrations/`
- Row-level security is **enabled and forced**; the app connects as the
  non-privileged role `app_user`
- Tenancy and role come from the auth token (`Bearer token-<tenant>-<role>`),
  never from client input
- Owner-only actions (project deletion) are enforced in the app *and* in a
  database policy
- Server-side localization (`en`, `fr`) with a test that both locales stay in sync

## Commands

```
npm install
npm test     # node --test
npm start    # http://localhost:3000
```
