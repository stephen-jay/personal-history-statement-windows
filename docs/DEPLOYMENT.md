# APOLLO Personnel Database - Deployment Guide

## Building the .EXE Installer

### Prerequisites
- Node.js 16+ installed
- npm installed
- Windows 10+ (for building Windows installer)

### Build Steps

1. **Install Dependencies**
   ```powershell
   npm install
   ```

2. **Build the EXE Installer**
   ```powershell
   npm run dist
   ```
   This creates installers in the `dist/` folder:
   - `APOLLO Personnel Database Setup x.x.x.exe` - NSIS installer (full installer with uninstall)
   - `APOLLO Personnel Database x.x.x.exe` - Portable version (no installation required)

3. **Test the Built Application**
   ```powershell
   npm test  # If test script is available
   # OR manually launch from dist/
   ```

## Deployment to Server

### Server Requirements
- PostgreSQL 13+ database server
- Network connectivity to the target machine
- Database credentials prepared

### Environment Variables

The application supports the following environment variables for deployment:

#### Database Configuration
```powershell
# PostgreSQL Connection (required for using database instead of local JSON files)
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:PORT/DBNAME"

# Read from PostgreSQL (fallback to JSON if unavailable)
$env:USE_POSTGRES_READ = "true"

# Write to PostgreSQL (otherwise uses local JSON files)
$env:USE_POSTGRES_WRITE = "true"

# Enable dual-write (writes to both PostgreSQL and local JSON backup)
$env:ENABLE_DUAL_WRITE = "true"
```

#### Remote API Configuration  
```powershell
# Use remote API instead of local database
$env:USE_REMOTE_API = "false"

# Remote API base URL (if using remote API)
$env:REMOTE_API_BASE = "http://API_HOST:3210"
```

### Installation on Target Machine

1. **Copy the installer to the server/target machine**
   ```powershell
   # From your build machine
   Copy-Item -Path "dist\APOLLO Personnel Database Setup*.exe" -Destination "\\HOST\shared\installers\" -Force
   ```

2. **Run the installer on the target machine**
   - Double-click the `.exe` file
   - Follow the installation wizard
   - Choose installation directory (default: `C:\Program Files\APOLLO Personnel Database`)

3. **Configure Environment Variables** (on target machine)

   **Option A: System Environment Variables (Recommended for Services)**
   - Open System Properties (`Win+X` → System)
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Add new System variables:
     - `DATABASE_URL`: Your PostgreSQL connection string
     - `USE_POSTGRES_READ`: `true`
     - `USE_POSTGRES_WRITE`: `true`
   - Restart the application

   **Option B: Create a .env file**
   - Create `.env` in the application installation directory:
     ```
     DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
     USE_POSTGRES_READ=true
     USE_POSTGRES_WRITE=true
     ENABLE_DUAL_WRITE=true
     ```

   **Option C: Create a launch script** (`launch.bat`)
   ```batch
   @echo off
   set DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
   set USE_POSTGRES_READ=true
   set USE_POSTGRES_WRITE=true
   set ENABLE_DUAL_WRITE=true
   
   start "" "C:\Program Files\APOLLO Personnel Database\APOLLO Personnel Database.exe"
   ```

## Database Setup & Testing

### Create PostgreSQL Database

Connect to your PostgreSQL server and run:

```sql
-- Create database
CREATE DATABASE apollo_db
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8';

-- Apply schema (from config/apollo-postgres-schema.sql)
\c apollo_db
\i 'config/apollo-postgres-schema.sql'
```

### Test Database Connection

Before deploying, test the connection:

```powershell
# Set environment variable
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:PORT/DBNAME"

# Run a test connection script (optional - creates test-db-connection.js)
npm run test:db  # If available

# Or manually test by starting the app
npm start
```

### Verify Database Queries Working

1. **Launch the application**
2. **Login with your credentials**
3. **Test CRUD operations:**
   - **Create**: Add a new personnel record
   - **Read**: View the roster list
   - **Update**: Edit an existing record
   - **Delete**: Remove a test record (if permitted)
4. **Monitor logs**: Check the console for any database errors

## Operational Notes

### Logging
- Application logs are written to the user's AppData directory
- Location: `C:\Users\<username>\AppData\Local\APOLLO Personnel Database\`
- Check for `.log` files if issues occur

### Data Storage
- **With PostgreSQL**: Primary storage is PostgreSQL database
- **With Dual-Write**: Backup JSON files stored in AppData
- **Fallback**: If PostgreSQL is unavailable, app uses local JSON storage

### Backup & Recovery
```powershell
# Backup PostgreSQL database
pg_dump -h HOST -U username -W apollo_db > backup_apollo_db.sql

# Restore PostgreSQL database
psql -h HOST -U username -W apollo_db < backup_apollo_db.sql
```

## Troubleshooting

### Application won't connect to database
1. Verify `DATABASE_URL` environment variable is set correctly
2. Check network connectivity to PostgreSQL server
3. Verify database credentials
4. Check firewall rules on the PostgreSQL server

### "DATABASE_URL is required for Postgres read/write"
- Environment variable not set
- Set it before launching the application
- Restart the application after setting the variable

### Concurrency conflicts during save/delete
- Another user is editing the same record
- Reload the roster and retry
- This is normal behavior for multi-user scenarios

### Records not persisting
- Check that `USE_POSTGRES_WRITE=true` is set OR check that permissions exist for the JSON data file
- Verify PostgreSQL write permissions
- Check application logs for errors

## Port & Connectivity

- **Application Port**: Uses native OS networking (no specific port required for app itself)
- **PostgreSQL Port**: Default 5432 (verify with your database admin)
- **Remote API Port**: 3210 (if using `USE_REMOTE_API=true`)

## Security Recommendations

1. **Never commit database credentials** to version control
2. **Use strong passwords** for database accounts
3. **Restrict database network access** - only allow necessary IPs
4. **Enable SSL/TLS** for PostgreSQL connections if on untrusted networks
5. **Regularly backup** all personnel data
6. **Audit logs** - monitor who accesses what data

## Support & Debug

If issues occur:
1. Check environment variables are set: `Get-Item env:DATABASE_URL`
2. Verify database connectivity with tools like pgAdmin
3. Review application logs in AppData
4. Check Windows Event Viewer for application crashes
5. Run the application in development mode for more verbose logging:
   ```powershell
   npm start
   ```
