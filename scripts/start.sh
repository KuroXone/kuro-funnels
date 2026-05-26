#!/usr/bin/env bash
# start.sh — enforces exactly one frontend and one backend process.
# Run via: make dev  OR  bash scripts/start.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
PID_DIR="$ROOT/.pids"

# ── Load ports from root .env ────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

mkdir -p "$PID_DIR"

# ── Helper: kill any process holding a port ──────────────────────────────────
free_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti TCP:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  ⚠  Port $port occupied (PID $pids) — killing..."
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
}

# ── Helper: wait until a port is accepting connections (max 15 s) ────────────
wait_for_port() {
  local port="$1"
  local label="$2"
  for i in $(seq 1 15); do
    if lsof -ti TCP:"$port" > /dev/null 2>&1; then
      echo "  ✓  $label ready on port $port"
      return 0
    fi
    sleep 1
  done
  echo "  ✗  $label did not start on port $port after 15 s" >&2
  return 1
}

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       KURO-FUNNELS  DEV START        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Step 1: ensure ports are free ────────────────────────────────────────────
echo "→ Clearing ports..."
free_port "$BACKEND_PORT"
free_port "$FRONTEND_PORT"

# ── Step 2: start backend ─────────────────────────────────────────────────────
echo "→ Starting backend (port $BACKEND_PORT)..."
cd "$ROOT/backend"
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload \
  > /tmp/kuro-backend.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_DIR/backend.pid"

wait_for_port "$BACKEND_PORT" "Backend"

# ── Step 3: start frontend ────────────────────────────────────────────────────
echo "→ Starting frontend (port $FRONTEND_PORT)..."
cd "$ROOT/app"
npm run dev > /tmp/kuro-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"

wait_for_port "$FRONTEND_PORT" "Frontend"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "┌──────────────────────────────────────────┐"
echo "│  Frontend  →  http://localhost:$FRONTEND_PORT       │"
echo "│  Backend   →  http://localhost:$BACKEND_PORT        │"
echo "│  API docs  →  http://localhost:$BACKEND_PORT/docs   │"
echo "│                                          │"
echo "│  Logs:  tail -f /tmp/kuro-backend.log    │"
echo "│         tail -f /tmp/kuro-frontend.log   │"
echo "│                                          │"
echo "│  Stop:  make stop                        │"
echo "└──────────────────────────────────────────┘"
echo ""
