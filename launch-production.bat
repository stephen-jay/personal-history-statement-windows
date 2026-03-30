@echo off
REM =============================================================================
REM APOLLO Personnel Database - Launch Script with Production Configuration
REM =============================================================================
REM
REM This script sets environment variables and launches the application.
REM
REM IMPORTANT: Update the DATABASE_URL value below with your actual PostgreSQL
REM            connection credentials before running this script.
REM
REM =============================================================================

REM Set your PostgreSQL connection string here
SET DATABASE_URL=postgresql://apollo_app:ApolloApp2026@10.10.218.144:5432/apollo_db

REM Enable PostgreSQL read operations (fallback to JSON if unavailable)
SET USE_POSTGRES_READ=true

REM Enable PostgreSQL write operations
SET USE_POSTGRES_WRITE=true

REM Enable dual-write (backup JSON files alongside PostgreSQL)
SET ENABLE_DUAL_WRITE=true

REM Optional: Use remote API instead of local database
REM SET USE_REMOTE_API=false

REM Optional: Remote API base URL
REM SET REMOTE_API_BASE=http://10.10.218.144:3210

REM =============================================================================
REM Launch the application
REM =============================================================================

REM Get the directory where this script is located
SET SCRIPT_DIR=%~dp0

REM Check if running from Program Files (installed version)
IF EXIST "%ProgramFiles%\APOLLO Personnel Database\APOLLO Personnel Database.exe" (
    echo Launching APOLLO Personnel Database from Program Files...
    start "" "%ProgramFiles%\APOLLO Personnel Database\APOLLO Personnel Database.exe"
    exit /b 0
)

REM Check if running from current directory (development mode)
IF EXIST "%SCRIPT_DIR%node_modules\.bin\electron.cmd" (
    echo Launching APOLLO Personnel Database in development mode...
    cd /d "%SCRIPT_DIR%"
    call npm start
    exit /b %ERRORLEVEL%
)

REM Fallback: Try to find the executable
IF EXIST "%SCRIPT_DIR%dist\APOLLO Personnel Database.exe" (
    echo Launching APOLLO Personnel Database from dist folder...
    start "" "%SCRIPT_DIR%dist\APOLLO Personnel Database.exe"
    exit /b 0
)

REM If we get here, we couldn't find the application
echo.
echo ERROR: Could not find APOLLO Personnel Database executable.
echo.
echo Please ensure one of the following:
echo  1. Application is installed in: %ProgramFiles%\APOLLO Personnel Database\
echo  2. Running from development directory with dependencies installed (npm install)
echo  3. dist folder exists with built application (npm run dist)
echo.
pause
exit /b 1
