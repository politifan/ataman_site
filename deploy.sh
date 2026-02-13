#!/usr/bin/env bash
set -euo pipefail

# Auto-detect project root from script location
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_ACTIVATE="/var/www/u3115521/data/venv/bin/activate"
RESTART_FILE="${APP_DIR}/passenger_wsgi.py"
# Keep CLI value (e.g. BUILD_FRONTEND=1 ./deploy.sh) as highest priority.
CLI_BUILD_FRONTEND="${BUILD_FRONTEND:-}"
BUILD_FRONTEND="${BUILD_FRONTEND:-1}"

cd "$APP_DIR"

source "$VENV_ACTIVATE"

# Load backend env vars into shell environment for init scripts.
if [ -f "$APP_DIR/app/backend/.env" ]; then
  set -a
  source "$APP_DIR/app/backend/.env"
  set +a
fi

# Re-apply CLI override after loading .env so .env cannot silently disable build.
if [ -n "$CLI_BUILD_FRONTEND" ]; then
  BUILD_FRONTEND="$CLI_BUILD_FRONTEND"
fi

echo "BUILD_FRONTEND=$BUILD_FRONTEND"

# Backend dependencies
python -m pip install --upgrade pip
python -m pip install -r app/backend/requirements.txt
python app/backend/init_db.py

# Optional frontend build (if Node.js exists on server)
if [ "$BUILD_FRONTEND" = "1" ]; then
  # Try to load nvm (common on shared hosting).
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck source=/dev/null
    source "$HOME/.nvm/nvm.sh"
  fi

  # Ensure a modern Node is active for Vite builds (Node >= 18, npm >= 8).
  if command -v nvm >/dev/null 2>&1; then
    nvm use --lts >/dev/null 2>&1 || nvm install --lts >/dev/null 2>&1
  fi

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "BUILD_FRONTEND=1, but node/npm not found in PATH."
    exit 1
  fi

  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  NPM_MAJOR="$(npm -v | cut -d. -f1)"
  echo "Node: $(node -v), npm: $(npm -v)"

  if [ "$NODE_MAJOR" -lt 18 ] || [ "$NPM_MAJOR" -lt 8 ]; then
    echo "Node/npm too old for Vite build. Required: Node >= 18 and npm >= 8."
    exit 1
  fi

  (
    cd app/frontend
    if ! npm ci --no-audit --no-fund; then
      echo "npm ci failed, fallback to npm install..."
      rm -rf node_modules
      npm install --no-audit --no-fund
    fi
    npm run build
  )
fi

# Trigger Passenger restart
touch "$RESTART_FILE"

python -c "import sys; print('Python:', sys.version)"
echo "Touched restart file: $RESTART_FILE"
