# API Server Deployment Guide

This guide covers deploying the PHS API server with process management, graceful shutdown, and structured logging.

## Prerequisites

- Ubuntu 22.04+ (or similar Linux distribution)
- Node.js 16+ installed
- PostgreSQL 13+ running and accessible
- `mapdroid` user exists

## Deployment Steps

### 1. Copy Files to Server

```bash
# Copy the deployment files to the server
scp phs-api.service mapdroid@10.10.218.144:/tmp/
scp phs-api.env.example mapdroid@10.10.218.144:/tmp/
```

### 2. Set Up Environment File

SSH into the server and create the environment configuration:

```bash
ssh mapdroid@10.10.218.144

# Copy the example environment file
sudo cp /tmp/phs-api.env.example /etc/default/phs-api

# Edit with actual credentials (use a strong AUTH_SECRET!)
sudo nano /etc/default/phs-api

# Set proper permissions (readable only by root and service)
sudo chmod 600 /etc/default/phs-api
sudo chown root:root /etc/default/phs-api
```

**Important:** Change `AUTH_SECRET` to a strong random value:
```bash
AUTH_SECRET=$(openssl rand -hex 32)
```

### 3. Install Systemd Service

```bash
# Copy service file
sudo cp /tmp/phs-api.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable phs-api

# Start the service
sudo systemctl start phs-api
```

### 4. Verify Service is Running

```bash
# Check service status
sudo systemctl status phs-api

# View recent logs (journalctl)
sudo journalctl -u phs-api -n 50 -f

# Check API health
curl http://localhost:3210/health
```

### 5. Create Logs Directory

The API will write structured logs to `/var/log/phs-api/`:

```bash
sudo mkdir -p /var/log/phs-api
sudo chown mapdroid:mapdroid /var/log/phs-api
sudo chmod 755 /var/log/phs-api
```

### 6. Set Up Log Rotation

Create `/etc/logrotate.d/phs-api`:

```bash
sudo nano /etc/logrotate.d/phs-api
```

Add:
```
/var/log/phs-api/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 mapdroid mapdroid
}
```

## Managing the Service

### Start/Stop/Restart

```bash
# Start
sudo systemctl start phs-api

# Stop (graceful shutdown, waits up to 15 seconds)
sudo systemctl stop phs-api

# Restart
sudo systemctl restart phs-api

# Reload configuration without restarting
sudo systemctl reload phs-api

# Check status
sudo systemctl status phs-api
```

### View Logs

```bash
# Real-time logs
sudo journalctl -u phs-api -f

# Last 100 lines
sudo journalctl -u phs-api -n 100

# Logs from last hour
sudo journalctl -u phs-api --since "1 hour ago"

# View application logs
sudo tail -f /var/log/phs-api/api-server.log
```

### View Application Logs (JSON format)

The API writes structured JSON logs to `/var/log/phs-api/api-server.log`:

```bash
# Pretty-print logs
sudo tail -f /var/log/phs-api/api-server.log | jq '.'

# Filter by log level
sudo cat /var/log/phs-api/api-server.log | jq 'select(.level=="ERROR")'

# Filter by timestamp
sudo cat /var/log/phs-api/api-server.log | jq '.timestamp'
```

## Features

### Automatic Restart

- API automatically restarts if it crashes
- Restart delay: 5 seconds

### Graceful Shutdown

- Receives `SIGTERM` when systemd stops the service
- Closes HTTP server and drains connections
- Closes database connection pool cleanly
- Force-exits after 15 seconds if needed

### Structured Logging

All logs are in JSON format with:
- `timestamp`: ISO 8601 timestamp
- `level`: INFO, WARN, ERROR, DEBUG, HTTP
- `message`: Log message
- `*`: Additional context fields

### Error Handling

- Uncaught exceptions are logged and exit gracefully
- Unhandled promise rejections are logged (but don't crash the process)
- Generic 404 and error handlers for all routes

## Troubleshooting

### Port 3210 Already in Use

```bash
# Check what's using the port
sudo lsof -i :3210

# Kill by PID (replace XXXX)
sudo kill -9 XXXX

# Or let systemd restart the service
sudo systemctl restart phs-api
```

### Service Won't Start

```bash
# Check status
sudo systemctl status phs-api

# Check journalctl for errors
sudo journalctl -u phs-api -n 50

# Check the environment file is readable
sudo cat /etc/default/phs-api
```

### Database Connection Issues

```bash
# Check DATABASE_URL in environment file
sudo cat /etc/default/phs-api | grep DATABASE_URL

# Test connection
psql "postgresql://apollo_app:ApolloApp2026@10.10.218.144:5432/apollo_db" -c "SELECT 1"
```

## Security Notes

1. **Credentials**: `AUTH_SECRET` and database password should be:
   - Strong random values
   - Never committed to git
   - Only in `/etc/default/phs-api` with `chmod 600`

2. **Service User**: The `mapdroid` user should have minimal privileges
   - Only write access to `/var/log/phs-api/` and `/home/mapdroid/phs-api/personnel-images/`

3. **Firewall**: Only expose port 3210 to trusted networks

## Monitoring

### Health Check

```bash
# Simple health check
curl http://localhost:3210/health

# Response if healthy: {"ok":true}
```

### Set Up Monitoring

Consider adding to a monitoring system:
- Check `systemctl status phs-api` exit code
- Parse JSON logs for ERROR entries
- Monitor port 3210 TCP connectivity
- Monitor CPU/memory usage

## Updates

To update the API code:

```bash
# Pull new code
cd /home/mapdroid/phs-api
git pull

# Restart the service
sudo systemctl restart phs-api

# Verify
sudo systemctl status phs-api
```

The service will automatically use the new code.
