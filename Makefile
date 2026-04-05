# NovaRetail — Makefile simple (raíz del repo).
# Requisitos: Node 18/20, Python3, Docker (Postgres). backend/.env y ml-service/.env configurados.
#
#   make up          Postgres + ML + API (dist) + Angular
#   make kill-all    Para ML, API y front (no toca Docker)
#   make restart-backend | restart-frontend | restart-ml
#
# Logs: .run/ml.log · backend.log · frontend.log

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
RUN_DIR := $(ROOT)/.run
WAIT_HTTP := $(ROOT)/scripts/wait-for-http.sh

ML_PORT ?= 8000
BACKEND_PORT ?= 4000
FRONTEND_PORT ?= 8080
# 1 = esperar a que Angular responda HTTP; 0 = solo lanzar nohup (útil si el health check falla en tu máquina)
FRONTEND_WAIT ?= 1

NODE ?= node
NG := $(ROOT)/frontend/node_modules/@angular/cli/bin/ng.js

.PHONY: help up start-all kill-all kill \
	restart-backend restart-frontend restart-ml \
	db-up db-down \
	run-ml run-backend run-frontend \
	kill-ml kill-backend kill-frontend

help:
	@echo "NovaRetail — comandos principales"
	@echo ""
	@echo "  make up | start-all   docker compose up -d (Postgres) + ML + Nest (build+dist) + ng serve"
	@echo "  FRONTEND_WAIT=0 make up   no exige curl al front (si 127.0.0.1/localhost fallan en tu OS)"
	@echo "  make kill-all         Detiene procesos en :$(ML_PORT) :$(BACKEND_PORT) :$(FRONTEND_PORT)"
	@echo "  make restart-backend  kill API + build + arranque en :$(BACKEND_PORT)"
	@echo "  make restart-frontend kill Angular + ng serve en :$(FRONTEND_PORT)"
	@echo "  make restart-ml       kill ML + uvicorn en :$(ML_PORT)"
	@echo ""
	@echo "  make db-up | db-down  Solo Postgres (Docker)"
	@echo "  make run-ml | run-backend | run-frontend   Arrancar un solo servicio (puerto libre)"
	@echo ""
	@echo "URLs:  http://localhost:$(FRONTEND_PORT)/  ·  http://localhost:$(BACKEND_PORT)/api/health  ·  ML http://localhost:$(ML_PORT)/live"
	@echo "Logs:  $(RUN_DIR)/"
	@echo ""
	@echo "Si fallan predicciones: ML_SERVICE_URL en backend/.env debe apuntar al ML (p. ej. http://localhost:$(ML_PORT))."
	@echo "Node 22 puede romper pg/Angular; usa Node 20 (brew install node@20)."

$(RUN_DIR):
	@mkdir -p $(RUN_DIR)

# --- Todo el stack aplicación + Postgres ---
up: start-all

start-all: $(RUN_DIR) db-up
	@$(MAKE) run-ml
	@sleep 2
	@$(MAKE) run-backend
	@sleep 1
	@$(MAKE) run-frontend
	@echo "[make] Listo. Front :$(FRONTEND_PORT) · API :$(BACKEND_PORT) · ML :$(ML_PORT)"

# --- Matar servicios Node/Python (no Docker) ---
kill-all: kill

kill: kill-frontend kill-backend kill-ml
	@echo "[make] Puertos $(FRONTEND_PORT) / $(BACKEND_PORT) / $(ML_PORT) liberados."

kill-ml:
	-@for p in $$(lsof -ti :$(ML_PORT) 2>/dev/null); do kill -9 $$p 2>/dev/null || true; done
	-@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	-@rm -f $(RUN_DIR)/ml.pid

kill-backend:
	-@for p in $$(lsof -ti :$(BACKEND_PORT) 2>/dev/null); do kill -9 $$p 2>/dev/null || true; done
	-@pkill -f "dist/main.js" 2>/dev/null || true
	-@pkill -f "tsx src/main.ts" 2>/dev/null || true
	-@pkill -f "nodemon" 2>/dev/null || true
	-@rm -f $(RUN_DIR)/backend.pid

kill-frontend:
	-@for p in $$(lsof -ti :$(FRONTEND_PORT) 2>/dev/null); do kill -9 $$p 2>/dev/null || true; done
	-@pkill -f "ng.js serve" 2>/dev/null || true
	-@rm -f $(RUN_DIR)/frontend.pid

# --- Reinicios por servicio ---
restart-backend: kill-backend
	@sleep 1
	@$(MAKE) run-backend

restart-frontend: kill-frontend
	@sleep 1
	@$(MAKE) run-frontend

restart-ml: kill-ml
	@sleep 1
	@$(MAKE) run-ml

# --- Arranque individual ---
run-ml: $(RUN_DIR)
	@if lsof -ti :$(ML_PORT) >/dev/null 2>&1; then echo "[make] Puerto $(ML_PORT) ocupado"; exit 1; fi
	@chmod +x "$(ROOT)/scripts/run-ml.sh" 2>/dev/null || true
	@echo "---- $$(date '+%Y-%m-%d %H:%M:%S') ML :$(ML_PORT) ----" > $(RUN_DIR)/ml.log
	@ROOT="$(ROOT)" ML_PORT="$(ML_PORT)" nohup "$(ROOT)/scripts/run-ml.sh" >> $(RUN_DIR)/ml.log 2>&1 & echo $$! > $(RUN_DIR)/ml.pid
	@echo "[make] ML pid $$(cat $(RUN_DIR)/ml.pid) → $(RUN_DIR)/ml.log"
	@"$(WAIT_HTTP)" "http://127.0.0.1:$(ML_PORT)/live" "ML" 90 1 8 || (tail -20 $(RUN_DIR)/ml.log; exit 1)

run-backend: $(RUN_DIR)
	@if lsof -ti :$(BACKEND_PORT) >/dev/null 2>&1; then echo "[make] Puerto $(BACKEND_PORT) ocupado"; exit 1; fi
	@test -d "$(ROOT)/backend/node_modules" || (echo "[make] cd backend && npm install"; exit 1)
	@echo "---- $$(date '+%Y-%m-%d %H:%M:%S') Nest :$(BACKEND_PORT) (npm run build + start) ----" > $(RUN_DIR)/backend.log
	@echo "[make] Compilando backend…"
	@cd "$(ROOT)/backend" && "$(NODE)" ./node_modules/typescript/lib/tsc.js -p tsconfig.build.json >> "$(RUN_DIR)/backend.log" 2>&1 || \
		(echo "[make] tsc falló — ver backend.log"; exit 1)
	@cd "$(ROOT)/backend" && nohup "$(NODE)" dist/main.js >> "$(RUN_DIR)/backend.log" 2>&1 & echo $$! > $(RUN_DIR)/backend.pid
	@echo "[make] API pid $$(cat $(RUN_DIR)/backend.pid) → $(RUN_DIR)/backend.log"
	@"$(WAIT_HTTP)" "http://127.0.0.1:$(BACKEND_PORT)/api/health" "Nest API" 120 1 5 || (tail -40 $(RUN_DIR)/backend.log; exit 1)

run-frontend: $(RUN_DIR)
	@if lsof -ti :$(FRONTEND_PORT) >/dev/null 2>&1; then echo "[make] Puerto $(FRONTEND_PORT) ocupado"; exit 1; fi
	@test -f "$(NG)" || (echo "[make] cd frontend && npm install"; exit 1)
	@echo "---- $$(date '+%Y-%m-%d %H:%M:%S') Angular :$(FRONTEND_PORT) ----" >> $(RUN_DIR)/frontend.log
# --host 0.0.0.0: escucha en IPv4; evita que solo quede en ::1 y falle curl a 127.0.0.1 (típico en macOS + localhost).
	@cd "$(ROOT)/frontend" && NG_CLI_ANALYTICS=false BROWSER=none nohup "$(NODE)" "$(NG)" serve --host 0.0.0.0 --port $(FRONTEND_PORT) \
		>> "$(RUN_DIR)/frontend.log" 2>&1 & echo $$! > $(RUN_DIR)/frontend.pid
	@echo "[make] Front pid $$(cat $(RUN_DIR)/frontend.pid) → $(RUN_DIR)/frontend.log"
	@echo "[make] Front URL  http://127.0.0.1:$(FRONTEND_PORT)/  y  http://localhost:$(FRONTEND_PORT)/"
ifeq ($(FRONTEND_WAIT),1)
	@"$(WAIT_HTTP)" "http://127.0.0.1:$(FRONTEND_PORT)/" "Angular" 240 1 15 || (echo "[make] Angular no respondió a tiempo — revisa $(RUN_DIR)/frontend.log"; tail -40 $(RUN_DIR)/frontend.log; exit 1)
else
	@echo "[make] FRONTEND_WAIT=0 — no se comprueba HTTP; espera unos segundos y abre http://localhost:$(FRONTEND_PORT)/"
endif

# --- Docker Postgres ---
db-up:
	@cd "$(ROOT)" && docker compose up -d
	@echo "[make] Postgres (docker compose) arriba."

db-down:
	@cd "$(ROOT)" && docker compose stop postgres 2>/dev/null || docker compose stop 2>/dev/null || true
