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

## Continuous deployment

The project includes a GitHub Actions workflow in `.github/workflows/release.yml` that builds Windows releases on tag pushes such as `v1.0.1` and publishes them to GitHub Releases.

The app also uses `electron-updater` so packaged builds can check GitHub Releases for updates at startup.

Required CI secrets for signed Windows releases:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

## PostgreSQL rollout artifacts

- `config/postgres-server-hardening.md`
- `config/apollo-postgres-schema.sql`
- `config/json-to-postgres-mapping.md`
- `config/postgres-cutover-controls.md`
- `config/postgres-handover-checklist.md`
- `scripts/import-json-to-postgres.js`
