# APOLLO Cutover Controls (Flags, Concurrency, Rollback)

Use this control document during transition from JSON storage to PostgreSQL.

## 1) Feature flags

Define and log these toggles on app/backend startup:

- `USE_POSTGRES_READ` (default `false`)
- `USE_POSTGRES_WRITE` (default `false`)
- `ENABLE_DUAL_WRITE` (default `false`)

Recommended sequence:

1. `READ=false WRITE=false DUAL=false` (current baseline)
2. `READ=true WRITE=false DUAL=false` (shadow read validation)
3. `READ=true WRITE=true DUAL=true` (short monitored window)
4. `READ=true WRITE=true DUAL=false` (steady state)

## 2) Optimistic locking

`personnel.version` is the concurrency token.

### Read

Return `version` with every personnel payload.

### Update

Require client/backend to send expected version:

```sql
UPDATE personnel
SET
  full_name = $2,
  present_job = $3,
  mobile = $4,
  email = $5,
  version = version + 1
WHERE id = $1
  AND version = $6
  AND deleted_at IS NULL
RETURNING id, version, updated_at;
```

If zero rows returned -> conflict; reload latest row and ask user to re-apply changes.

### Delete (soft delete)

```sql
UPDATE personnel
SET deleted_at = NOW(), version = version + 1
WHERE id = $1
  AND version = $2
  AND deleted_at IS NULL;
```

## 3) Rollback criteria

Trigger rollback to JSON writes if any condition is met:

- Import reconciliation mismatch > 0.5% of parent rows.
- API write error rate > 2% for 15 minutes.
- Any confirmed data-loss bug (missing rows after successful write).
- FK violation spikes after release.

Rollback action:

1. Set `USE_POSTGRES_WRITE=false`
2. Keep `USE_POSTGRES_READ=false` until incident resolved
3. Keep JSON writes active
4. Investigate and patch

## 4) Data integrity checks during cutover

Run every 10–15 minutes during cutover window:

```sql
SELECT COUNT(*) FROM personnel WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM personnel_children;
SELECT COUNT(*) FROM personnel_seminars_training;
```

And app-level checks:

- `personnel:getAll` count parity against expected baseline.
- Search parity (`fullName`, `mobile`, `email`, `presentJob`).
- Analytics parity for education buckets.

## 5) Observability requirements

- Log write path for each mutation: `json`, `postgres`, `dual`.
- Include request ID, record ID, version before/after.
- Track latency and error metrics for read/write endpoints separately.

## 6) Cutover sign-off checklist

- [ ] Shadow-read parity validated on production-like data.
- [ ] Write tests pass with optimistic lock conflict handling.
- [ ] Rollback toggles tested in staging.
- [ ] Backups verified (`pg_dump` + restore spot test).
- [ ] On-call owner assigned for cutover window.
