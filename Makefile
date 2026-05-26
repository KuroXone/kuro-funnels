## ─────────────────────────────────────────────────────────────────────────
##  Kuro-Funnels dev commands
##  Ports are defined once in .env (FRONTEND_PORT / BACKEND_PORT).
##  Never run npm run dev or uvicorn directly — always use these targets.
## ─────────────────────────────────────────────────────────────────────────

.PHONY: dev stop restart status clean logs help

# Load .env so make targets can reference the port variables
-include .env
export

FRONTEND_PORT ?= 5173
BACKEND_PORT  ?= 8000

## dev     — stop any running instance, then start frontend + backend cleanly
dev: stop
	@bash scripts/start.sh

## stop    — kill frontend + backend (by PID file, then by port as fallback)
stop:
	@bash scripts/stop.sh

## restart — full stop then fresh start
restart: stop dev

## status  — show what is running, flag any rogue servers
status:
	@bash scripts/status.sh

## clean   — stop services and wipe all build/cache artifacts
clean: stop
	@echo "→ Cleaning build artifacts and caches..."
	@rm -rf app/dist app/node_modules/.vite
	@find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@rm -f /tmp/kuro-frontend.log /tmp/kuro-backend.log
	@echo "  Done."

## logs    — tail both log files live (Ctrl-C to exit)
logs:
	@tail -f /tmp/kuro-backend.log /tmp/kuro-frontend.log

## help    — show this message
help:
	@grep -E '^##' Makefile | sed 's/## /  /'
