# APOLLO PostgreSQL Handover Checklist

This checklist packages all deliverables required to execute the server-first rollout.

## Deliverables in this repo

- Server hardening + connectivity:
  - `config/postgres-server-hardening.md`
- Full normalized schema and indexes:
  - `config/apollo-postgres-schema.sql`
- JSON mapping and import order/reconciliation:
  - `config/json-to-postgres-mapping.md`
- Cutover flags, optimistic locking, rollback:
  - `config/postgres-cutover-controls.md`
- Import script (JSON -> Postgres):
  - `scripts/import-json-to-postgres.js`

## Execution sequence

1. On Ubuntu server, apply hardening and DB role setup from `postgres-server-hardening.md`.
2. Apply schema:
   - `psql -h 127.0.0.1 -U apollo_app -d apollo_db -f config/apollo-postgres-schema.sql`
3. Run importer from application environment:
   - set `DATABASE_URL`
   - run `node scripts/import-json-to-postgres.js`
4. Run reconciliation queries from `json-to-postgres-mapping.md`.
5. Enable cutover flags in stages per `postgres-cutover-controls.md`.

## Validation gates (must pass before write cutover)

- [ ] `personnel` row count equals source JSON row count.
- [ ] No orphan rows in child tables.
- [ ] Roster read parity (name, mobile, email, updatedAt).
- [ ] Search parity across `fullName`, `mobile`, `presentJob`, `email`.
- [ ] Education analytics parity (attainment buckets and top fields).
- [ ] Backup tested (`pg_dump` + restore dry run).

## Rollback quick path

- Set:
  - `USE_POSTGRES_READ=false`
  - `USE_POSTGRES_WRITE=false`
  - `ENABLE_DUAL_WRITE=false`
- Keep JSON write path active until fix is deployed.

## Notes

- Current code still persists to local JSON (`main.js` handlers: `personnel:getAll`, `personnel:save`, `personnel:delete`).
- This pack prepares server/schema/migration first, then controlled app cutover.
