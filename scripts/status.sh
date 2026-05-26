#!/usr/bin/env bash
# status.sh — shows what is actually running for this project.
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

check_service() {
  local label="$1"
  local port="$2"
  local pid_file="$PID_DIR/$3.pid"
  local tracked_pid=""
  local live_pid=""

  [ -f "$pid_file" ] && tracked_pid=$(cat "$pid_file")
  live_pid=$(lsof -ti TCP:"$port" 2>/dev/null | head -1 || true)

  if [ -n "$live_pid" ]; then
    local cmd
    cmd=$(ps -p "$live_pid" -o comm= 2>/dev/null || echo "?")

    # The listener may be a child of the tracked PID (e.g. npm → node, uvicorn → worker).
    # Walk up the parent chain to see if tracked_pid is an ancestor.
    local is_ours=false
    if [ -n "$tracked_pid" ]; then
      local check_pid="$live_pid"
      for _ in 1 2 3 4 5; do
        if [ "$check_pid" = "$tracked_pid" ]; then
          is_ours=true; break
        fi
        check_pid=$(ps -p "$check_pid" -o ppid= 2>/dev/null | tr -d ' ') || break
        [ -z "$check_pid" ] || [ "$check_pid" = "1" ] && break
      done
    fi

    if $is_ours; then
      echo "  ✅  $label   port $port   PID $live_pid   ($cmd)   [tracked ✓]"
    else
      echo "  ⚠️   $label   port $port   PID $live_pid   ($cmd)   [UNTRACKED — not started via make/scripts]"
    fi
  else
    echo "  ❌  $label   port $port   NOT RUNNING"
  fi
}

# Check for any rogue node/vite processes NOT on the expected port
rogue=$(ps aux | grep -E "vite|node.*\.bin/vite" | grep -v grep | \
  awk -v fp="$FRONTEND_PORT" '{
    for(i=1;i<=NF;i++) if($i ~ /--port/) { if($(i+1) != fp) print $0 }
  }')

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       KURO-FUNNELS  STATUS           ║"
echo "╚══════════════════════════════════════╝"
echo ""
check_service "Frontend" "$FRONTEND_PORT" "frontend"
check_service "Backend " "$BACKEND_PORT"  "backend"

if [ -n "$rogue" ]; then
  echo ""
  echo "  ⚠️  ROGUE FRONTEND DETECTED on unexpected port:"
  echo "$rogue" | awk '{print "     PID "$2" → "$11" "$12" "$13}'
fi

echo ""
echo "  Port config source: $ENV_FILE"
echo ""
