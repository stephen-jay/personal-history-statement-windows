# APOLLO PostgreSQL Server Hardening (Ubuntu)

This is a server-first checklist for Ubuntu + PostgreSQL, scoped to APOLLO.

## 1) Baseline checks

```bash
uname -a
lsb_release -a
whoami
ip -4 a
```

If PostgreSQL is not installed:

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Verify status and version:

```bash
sudo systemctl status postgresql --no-pager
sudo -u postgres psql -c "SELECT version();"
```

## 2) Create dedicated APOLLO database and role

Replace `CHANGE_ME_STRONG_PASSWORD` with a generated password.

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE apollo_app WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE DATABASE apollo_db OWNER apollo_app;
REVOKE ALL ON DATABASE apollo_db FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE apollo_db TO apollo_app;
SQL
```

## 3) Network access restrictions (required for remote clients)

Find active config paths:

```bash
sudo -u postgres psql -t -P format=unaligned -c "SHOW config_file;"
sudo -u postgres psql -t -P format=unaligned -c "SHOW hba_file;"
```

Set `listen_addresses` in `postgresql.conf`:

```conf
listen_addresses = '127.0.0.1,10.10.218.144'
```

Add strict client rule to `pg_hba.conf` (replace `APP_CLIENT_IP`):

```conf
host    apollo_db    apollo_app    APP_CLIENT_IP/32    scram-sha-256
```

Reload:

```bash
sudo systemctl restart postgresql
```

## 4) Firewall rules

Allow SSH and PostgreSQL only from trusted sources.

```bash
sudo ufw allow OpenSSH
sudo ufw allow from APP_CLIENT_IP to any port 5432 proto tcp
sudo ufw enable
sudo ufw status numbered
```

## 5) Connectivity checks

Local check:

```bash
PGPASSWORD='CHANGE_ME_STRONG_PASSWORD' psql \
  "host=127.0.0.1 port=5432 dbname=apollo_db user=apollo_app sslmode=prefer" \
  -c "SELECT current_user, current_database();"
```

Remote check (from app/API machine):

```bash
PGPASSWORD='CHANGE_ME_STRONG_PASSWORD' psql \
  "host=10.10.218.144 port=5432 dbname=apollo_db user=apollo_app sslmode=prefer" \
  -c "SELECT now();"
```

## 6) Daily backup skeleton

Create script:

```bash
sudo tee /usr/local/bin/apollo-db-backup.sh >/dev/null <<'BASH'
#!/usr/bin/env bash
set -euo pipefail
TS=$(date +%Y%m%d_%H%M%S)
OUT_DIR=/var/backups/apollo_db
mkdir -p "$OUT_DIR"
pg_dump -Fc -h 127.0.0.1 -U apollo_app apollo_db > "$OUT_DIR/apollo_db_${TS}.dump"
find "$OUT_DIR" -type f -name '*.dump' -mtime +14 -delete
BASH
sudo chmod +x /usr/local/bin/apollo-db-backup.sh
```

Schedule cron (example 02:30 daily):

```bash
sudo crontab -e
# add:
30 2 * * * /usr/local/bin/apollo-db-backup.sh >> /var/log/apollo-db-backup.log 2>&1
```

## 7) Security reminders

- Rotate any credentials that were shared in chat/tools.
- Keep DB password in environment variables/secrets manager, never in source.
- Prefer API server access to DB; avoid direct desktop-client DB access in production.
