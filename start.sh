#!/bin/bash
set -e

# Start nginx in background
nginx

# Start backend (foreground to keep container running)
cd /app/backend
exec uvicorn server:app --host 127.0.0.1 --port 8001
