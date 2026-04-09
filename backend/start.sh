#!/bin/sh

echo "=== Fashion Street API Startup ==="
cd /app

echo "Starting server..."
exec node dist/app.js
