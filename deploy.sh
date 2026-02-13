#!/usr/bin/env bash
set -euo pipefail

# Auto-detect project root from script location
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_ACTIVATE="/var/www/u3115521/data/venv/bin/activate"
RESTART_FILE="${APP_DIR}/passenger_wsgi.py"
BUILD_FRONTEND="${BUILD_FRONTEND:-0}"

cd "$APP_DIR"

source "$VENV_ACTIVATE"

# Load backend env vars into shell environment for init scripts.
if [ -f "$APP_DIR/app/backend/.env" ]; then
  set -a
  source "$APP_DIR/app/backend/.env"
  set +a
fi

# Backend dependencies
python -m pip install --upgrade pip
python -m pip install -r app/backend/requirements.txt
python app/backend/init_db.py

# Optional frontend build (if Node.js exists on server)
if [ "$BUILD_FRONTEND" = "1" ]; then
  # Try to load nvm if npm is not in PATH (common on shared hosting).
  if ! command -v npm >/dev/null 2>&1; then
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
      # shellcheck source=/dev/null
      source "$HOME/.nvm/nvm.sh"
    fi
  fi

  # Ensure a modern Node is active for Vite builds.
  if command -v nvm >/dev/null 2>&1; then
    nvm use --lts >/dev/null 2>&1 || nvm install --lts >/dev/null 2>&1
  fi

  if command -v npm >/dev/null 2>&1; then
    (cd app/frontend && npm ci && npm run build)
  else
    echo "BUILD_FRONTEND=1, but npm not found. Skipping frontend build."
  fi
fi

# Trigger Passenger restart
touch "$RESTART_FILE"

python -c "import sys; print('Python:', sys.version)"
echo "Touched restart file: $RESTART_FILE"
