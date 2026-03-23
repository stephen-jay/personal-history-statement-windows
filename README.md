# Personnel Database

Windows desktop app for personnel records. **Personnel History Statement (PHS)** form.

Built with **Electron**. Data is stored in a **local JSON file** (no database required).

## Run the app

```bash
cd y:\APOLLO
npm install
npm start
```

## Build Windows installer (optional)

```bash
npm run dist
```

Installer output will be in the `dist` folder.

## PostgreSQL rollout artifacts

- `config/postgres-server-hardening.md`
- `config/apollo-postgres-schema.sql`
- `config/json-to-postgres-mapping.md`
- `config/postgres-cutover-controls.md`
- `config/postgres-handover-checklist.md`
- `scripts/import-json-to-postgres.js`
