#!/usr/bin/env bash
# stop.sh — kills the tracked frontend and backend processes.
# Falls back to port-based kill if PID files are missing.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
PID_DIR="$ROOT/.pids"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

kill_by_pid_file() {
  local label="$1"
  local pid_file="$2"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    # kill the whole process group so child workers die too
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
      echo "  ✓  Stopped $label (PID $pid)"
    else
      echo "  –  $label was not running"
    fi
    rm -f "$pid_file"
  else
    echo "  –  No PID file for $label"
  fi
}

kill_by_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti TCP:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    echo "  ✓  Freed port $port (PID $pids)"
  fi
}

echo ""
echo "→ Stopping services..."
kill_by_pid_file "backend"  "$PID_DIR/backend.pid"
kill_by_pid_file "frontend" "$PID_DIR/frontend.pid"

echo "→ Port sweep (fallback)..."
kill_by_port "$BACKEND_PORT"
kill_by_port "$FRONTEND_PORT"

echo "→ Done. All project services stopped."
echo ""
