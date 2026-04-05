# NovaRetail — ML + Nest + Angular local
# Ejecutar SIEMPRE desde la raíz del repo (carpeta que contiene este Makefile).
# Uso: make run | make kill | make restart | make rerun
#
# Node: el driver pg falla con Node 22 (dependencia circular pg ↔ pg-pool).
# Usa Node 20 LTS, p. ej.: brew install node@20
#   export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
# o bien:
#   make run-backend NODE_BACKEND=/ruta/a/node20/bin/node

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
RUN_DIR := $(ROOT)/.run

ML_PORT ?= 8000
BACKEND_PORT ?= 4000
FRONTEND_PORT ?= 8080
# Arranque frío (FastAPI/iCloud Desktop) puede tardar varios minutos; /live es ligero.
ML_HEALTH_ATTEMPTS ?= 360
# Nest: carga de módulos (TypeORM + deps) + TypeORM/Postgres (~15s timeout) antes de escuchar :4000. FS lentos: sube a 300+.
BACKEND_HEALTH_ATTEMPTS ?= 240
# Si 1, siempre ejecuta tsc antes de arrancar. Si 0, solo compila si falta dist/ o hay .ts más nuevos.
BACKEND_FORCE_BUILD ?= 0
# tsx = sin tsc (recomendado en Mac/iCloud; evita “colgado” sin salida). dist = tsc + node dist/main.js.
BACKEND_EXEC_MODE ?= tsx
# Binario de Node para el API (Node 22 rompe `pg`; se prueba Node 20 automáticamente).
# Si el script falla (p. ej. sandbox), se intenta Node@20 típico de Homebrew.
NODE_BACKEND ?= $(shell "$(ROOT)/scripts/resolve-node-backend.sh" 2>/dev/null || (test -x /opt/homebrew/opt/node@20/bin/node && echo /opt/homebrew/opt/node@20/bin/node) || (test -x /usr/local/opt/node@20/bin/node && echo /usr/local/opt/node@20/bin/node))
# Carpeta bin del Node del API (Make: evita $(dirname …) en receta, que Make interpreta mal).
BACKEND_NODE_BINDIR := $(dir $(NODE_BACKEND))
# Angular CLI (`ng serve`): Node 22 suele lanzar "Class extends value undefined"; preferimos Node 20.
NODE_FRONTEND ?= $(shell "$(ROOT)/scripts/resolve-node-lts.sh")
FRONTEND_NODE_BINDIR := $(dir $(NODE_FRONTEND))

# Los sub-makes (`$(MAKE) run-backend`) heredan el entorno: así no se vuelve a ejecutar
# resolve-node-backend.sh (lento / puede bloquearse) en cada sub-make.
export NODE_BACKEND
export NODE_FRONTEND

.PHONY: help check run run-web run-no-ml kill restart rerun run-ml run-backend run-backend-watch run-frontend \
	kill-ml kill-backend kill-frontend db-up db-down

WAIT_HTTP := $(ROOT)/scripts/wait-for-http.sh
TSX_CLI := $(ROOT)/backend/node_modules/tsx/dist/cli.mjs
NG_CLI := $(ROOT)/frontend/node_modules/@angular/cli/bin/ng.js

help:
	@echo "NovaRetail — ejecutar SIEMPRE desde la raíz del repo (donde está este Makefile)."
	@echo ""
	@echo "Comandos principales:"
	@echo "  make check       Comprueba Node, Python y dependencias npm/venv"
	@echo "  make run         Arranca ML + Nest + Angular (API: tsc solo si hace falta + node dist)"
	@echo "  make run-web     Solo API + Angular, sin ML; API con node dist/main.js (tsc si hace falta) — estable"
	@echo "  make run-no-ml   Alias de run-web"
	@echo "  make kill        Detiene los tres servicios y libera puertos"
	@echo "  make restart     make kill && make run"
	@echo "  make rerun       kill + db-up + run (reinicio completo con Postgres)"
	@echo "  make db-up       docker compose up -d postgres (requiere Docker)"
	@echo "  make db-down     docker compose stop postgres"
	@echo ""
	@echo "Por servicio:"
	@echo "  make run-ml | run-backend | run-backend-watch | run-frontend"
	@echo "  make kill-ml | kill-backend | kill-frontend"
	@echo ""
	@echo "Puertos (sobrescribibles: ML_PORT, BACKEND_PORT, FRONTEND_PORT):"
	@echo "  ML       http://localhost:$(ML_PORT)  (make espera /live; diagnóstico: /health)"
	@echo "  API      http://localhost:$(BACKEND_PORT)/api/health"
	@echo "  Angular  http://localhost:$(FRONTEND_PORT)/  (origen del SPA; Cognito/CORS deben coincidir)"
	@echo ""
	@echo "Logs: $(RUN_DIR)/ml.log | backend.log | frontend.log"
	@echo ""
	@echo "Si el front muestra 504 en /api/...: el proxy de :8080 espera al API en :4000."
	@echo "  Arranca Postgres (\`make db-up\`) y el API; prueba \`curl -s http://localhost:4000/api/health\`."
	@echo "Por defecto el API arranca con \`tsx\` (sin tsc). Modo compilado: \`BACKEND_EXEC_MODE=dist make run-backend\`."
	@echo "  Producción: \`cd backend && npm run build && node dist/main.js\`."
	@echo "  NODE_BACKEND / NODE_FRONTEND se exportan a los sub-makes. \`make run-backend\` rechaza Node 22+."
	@echo "  Con dist: BACKEND_FORCE_BUILD=1 fuerza \`tsc\` cuando haga falta; la salida de tsc va en vivo a terminal y backend.log."
	@echo ""
	@echo "Node 20 LTS recomendado (Node 22 rompe \`pg\` y a veces Angular CLI):"
	@echo "  brew install node@20"
	@echo "  export PATH=\"/opt/homebrew/opt/node@20/bin:\$$PATH\"   # Apple Silicon"
	@echo "  o:  NODE_FRONTEND=/ruta/node20/bin/node NODE_BACKEND=\$$NODE_FRONTEND make run"
	@echo ""
	@echo "Si tsx falla (poco habitual): \`BACKEND_EXEC_MODE=dist make run-backend\`."
	@echo "Predicciones ML: \`make run-ml\` o \`make run\` completo."
	@echo "Usa siempre Node 20 en PATH; Node 22 rompe pg, Angular y herramientas del backend."

check:
	@echo "=== make check — NovaRetail ==="
	@printf "Scripts: "; test -x "$(ROOT)/scripts/resolve-node-backend.sh" && test -x "$(ROOT)/scripts/resolve-node-lts.sh" && test -x "$(ROOT)/scripts/wait-for-http.sh" && echo "OK (ejecutables)" || echo "FALTA chmod +x scripts/*.sh"
	@printf "Node (Angular / resolve-node-lts): "; \
		BIN=$$("$(ROOT)/scripts/resolve-node-lts.sh"); "$$BIN" -v 2>&1 || true
	@printf "Node (PATH, referencia): "; command -v node >/dev/null 2>&1 && node -v || echo "—"
	@echo "  Al hacer \`make run-backend\` se usa \`scripts/resolve-node-backend.sh\` (elige Node 20 que cargue \`pg\` en ./backend)."
	@command -v python3 >/dev/null 2>&1 && python3 --version || echo "[aviso] python3 no está en PATH"
	@test -d "$(ROOT)/frontend/node_modules" || echo "[aviso] cd frontend && npm install"
	@test -d "$(ROOT)/backend/node_modules" || echo "[aviso] cd backend && npm install"
	@test -x "$(ROOT)/ml-service/.venv/bin/python3" || echo "[info] ML: falta ml-service/.venv → cd ml-service && python3 -m venv .venv && pip install -r requirements.txt"
	@command -v docker >/dev/null 2>&1 || echo "[info] Docker no instalado: omite make db-up o instálalo para Postgres"
	@echo "Siguiente: make db-up (opcional) && make run"

$(RUN_DIR):
	@mkdir -p $(RUN_DIR)

# Cada paso en un sub-make: si falla uno, make run aborta y no arranca el siguiente servicio.
run: $(RUN_DIR)
	@echo "[make] Iniciando servicios → $(RUN_DIR)/"
	@$(MAKE) run-ml
	@sleep 1
	@$(MAKE) run-backend
	@sleep 1
	@$(MAKE) run-frontend
	@echo "[make] Listo. ML/API/UI → http://localhost:$(ML_PORT) · :$(BACKEND_PORT)/api/health · :$(FRONTEND_PORT)/"

# API + Angular. Por defecto API en modo tsx (rápido). Para solo dist: BACKEND_EXEC_MODE=dist make run-web
run-web: $(RUN_DIR)
	@echo "[make] run-web: Postgres debe estar arriba (\`make db-up\`). Sin ML en :$(ML_PORT)."
	@$(MAKE) run-backend
	@sleep 1
	@$(MAKE) run-frontend
	@echo "[make] Listo (sin ML). API http://localhost:$(BACKEND_PORT)/api/health · UI http://localhost:$(FRONTEND_PORT)/"

run-no-ml: run-web

run-ml: $(RUN_DIR)
	@if lsof -ti :$(ML_PORT) >/dev/null 2>&1; then \
		echo "[make] Puerto $(ML_PORT) ocupado"; exit 1; \
	fi
	@printf '%s\n' "---- $$(date '+%Y-%m-%d %H:%M:%S') make run-ml ML :$(ML_PORT) ----" > $(RUN_DIR)/ml.log
	@chmod +x "$(ROOT)/scripts/run-ml.sh" 2>/dev/null || true
	@ROOT="$(ROOT)" ML_PORT="$(ML_PORT)" nohup "$(ROOT)/scripts/run-ml.sh" >> $(RUN_DIR)/ml.log 2>&1 & echo $$! > $(RUN_DIR)/ml.pid
	@printf '%s\n' "[make] pid $$(cat $(RUN_DIR)/ml.pid) ← scripts/run-ml.sh (nohup)" >> $(RUN_DIR)/ml.log
	@echo "[make] ML PID $$(cat $(RUN_DIR)/ml.pid) → ml.log"
	@echo "[make] Esperando ML http://localhost:$(ML_PORT)/live (hasta ~$(ML_HEALTH_ATTEMPTS)s; primer arranque Python puede tardar)…"
	@$(WAIT_HTTP) "http://localhost:$(ML_PORT)/live" "ML (localhost:$(ML_PORT) /live)" $(ML_HEALTH_ATTEMPTS) 1 8 || \
		(echo "[make] ML no respondió. Últimas líneas de ml.log:"; tail -25 $(RUN_DIR)/ml.log; exit 1)

run-backend: $(RUN_DIR)
	@if [ -z "$(NODE_BACKEND)" ]; then \
		echo "[make] NODE_BACKEND vacío: ejecuta scripts/resolve-node-backend.sh o exporta NODE_BACKEND=/ruta/node20/bin/node"; exit 1; \
	fi
	@MAJOR=$$($(NODE_BACKEND) -p "parseInt(process.versions.node,10)" 2>/dev/null); \
	if [ "$$MAJOR" != "18" ] && [ "$$MAJOR" != "20" ]; then \
		echo "[make] ERROR: el API debe ejecutarse con Node 18 o 20 (ahora major=$$MAJOR con $(NODE_BACKEND))."; \
		echo "       Node 22+ rompe \`pg\`/TypeORM/Nest en este proyecto. brew install node@20 y:"; \
		echo "       export PATH=\"/opt/homebrew/opt/node@20/bin:\$$PATH\"   o   NODE_BACKEND=/ruta/node20/bin/node make run-backend"; \
		exit 1; \
	fi
	@if lsof -ti :$(BACKEND_PORT) >/dev/null 2>&1; then \
		echo "[make] Puerto $(BACKEND_PORT) ocupado"; exit 1; \
	fi
	@test -d "$(ROOT)/backend/node_modules" || (echo "[make] ERROR: falta backend/node_modules → cd backend && npm install"; exit 1)
	@_fs_t="$(ROOT)/backend/node_modules/@types/node/fs.d.ts"; \
	_fs_i="$(ROOT)/backend/node_modules/@types/node/fs/index.d.ts"; \
	test -f "$$_fs_t" || test -f "$$_fs_i" || (echo "[make] ERROR: @types/node incompleto o corrupto (faltan tipos de fs). Repara dependencias:"; \
		echo "       cd $(ROOT)/backend && rm -rf node_modules && npm install"; exit 1)
	@printf '%s\n' "---- $$(date '+%Y-%m-%d %H:%M:%S') make run-backend mode=$(BACKEND_EXEC_MODE) Node=$(NODE_BACKEND) (log reiniciado) ----" > $(RUN_DIR)/backend.log
	@cd $(ROOT)/backend && $(NODE_BACKEND) -e "require('pg')" >> /dev/null 2>&1 || \
		(echo ""; \
		 echo "[make] ERROR: require('pg') falla con $$($(NODE_BACKEND) -v 2>/dev/null)."; \
		 echo "       Con Node 22 el driver pg de TypeORM no carga. Usa Node 20 LTS y vuelve a ejecutar,"; \
		 echo "       o:  make run-backend NODE_BACKEND=/ruta/al/binario/de/node20"; \
		 echo "       Ver también: .nvmrc en la raíz del repo."; \
		 echo ""; exit 1)
	@cd $(ROOT)/backend && \
	export PATH="$(BACKEND_NODE_BINDIR):$$PATH" && \
	if [ "$(BACKEND_EXEC_MODE)" = "tsx" ]; then \
		test -f node_modules/tsx/dist/cli.mjs || (echo "[make] ERROR: falta tsx → cd backend && npm install"; exit 1); \
		echo "[make] API: modo tsx — sin tsc (arranque rápido)." | tee -a $(RUN_DIR)/backend.log; \
	elif [ "$(BACKEND_EXEC_MODE)" = "dist" ]; then \
		needs=0; \
		if [ ! -f dist/main.js ]; then needs=1; fi; \
		if [ "$(BACKEND_FORCE_BUILD)" = "1" ]; then needs=1; fi; \
		if [ "$$needs" -eq 0 ] && find src -name '*.ts' -newer dist/main.js 2>/dev/null | head -1 | grep -q .; then needs=1; fi; \
		if [ "$$needs" -eq 1 ]; then \
			echo "[make] API: compilando backend (tsc; salida en vivo abajo)…" | tee -a $(RUN_DIR)/backend.log; \
			test -f node_modules/typescript/lib/tsc.js || (echo "[make] ERROR: falta typescript en backend → cd backend && npm install"; exit 1); \
			bash -c 'set -o pipefail; cd '"$(ROOT)"'/backend && export PATH='"$(BACKEND_NODE_BINDIR)"':$$PATH && NODE_OPTIONS= '"$(NODE_BACKEND)"' ./node_modules/typescript/lib/tsc.js -p tsconfig.build.json 2>&1 | tee -a '"$(RUN_DIR)"'/backend.log; exit $${PIPESTATUS[0]}' || (echo "[make] ERROR: tsc falló."; exit 1); \
		else \
			echo "[make] API: dist al día → sin tsc (BACKEND_FORCE_BUILD=1 para forzar compilación)." | tee -a $(RUN_DIR)/backend.log; \
		fi; \
	else \
		echo "[make] ERROR: BACKEND_EXEC_MODE debe ser dist o tsx (recibido: $(BACKEND_EXEC_MODE))"; exit 1; \
	fi
	@if [ "$(BACKEND_EXEC_MODE)" = "tsx" ]; then \
		echo "[make] API: arrancando Nest (tsx src/main.ts)…"; \
	else \
		echo "[make] API: arrancando Nest (node dist/main.js)…"; \
	fi
	@cd $(ROOT)/backend && \
	export PATH="$(BACKEND_NODE_BINDIR):$$PATH" && \
	if [ "$(BACKEND_EXEC_MODE)" = "tsx" ]; then \
		nohup env NODE_OPTIONS= "$(NODE_BACKEND)" ./node_modules/tsx/dist/cli.mjs src/main.ts >> $(RUN_DIR)/backend.log 2>&1 & echo $$! > $(RUN_DIR)/backend.pid; \
	else \
		nohup "$(NODE_BACKEND)" dist/main.js >> $(RUN_DIR)/backend.log 2>&1 & echo $$! > $(RUN_DIR)/backend.pid; \
	fi
	@echo "[make] Backend PID $$(cat $(RUN_DIR)/backend.pid) → backend.log ($(NODE_BACKEND) $$(cd $(ROOT)/backend && $(NODE_BACKEND) -v 2>/dev/null))"
	@$(WAIT_HTTP) "http://localhost:$(BACKEND_PORT)/api/health" "Nest API (:$(BACKEND_PORT))" $(BACKEND_HEALTH_ATTEMPTS) 1 || \
		(echo "[make] ERROR: el API no escucha en :$(BACKEND_PORT) (Nest no llama a listen hasta conectar TypeORM)."; \
		 echo "       1) Postgres: \`docker compose up -d postgres\` y \`docker compose ps\`"; \
		 echo "       2) backend/.env → DATABASE_URL (p. ej. postgresql://novaretail:novaretail_dev@localhost:5432/novaretail)"; \
		 echo "       3) Prueba: curl -sS -m 5 http://localhost:$(BACKEND_PORT)/api/health"; \
		 echo "       Últimas líneas del log de ESTE arranque:"; tail -60 $(RUN_DIR)/backend.log; exit 1)

# Mismo que run-backend pero con tsx watch (puede colgarse en algunos Mac; solo para desarrollo).
run-backend-watch: $(RUN_DIR)
	@if [ -z "$(NODE_BACKEND)" ]; then \
		echo "[make] NODE_BACKEND vacío"; exit 1; \
	fi
	@if lsof -ti :$(BACKEND_PORT) >/dev/null 2>&1; then \
		echo "[make] Puerto $(BACKEND_PORT) ocupado"; exit 1; \
	fi
	@test -d "$(ROOT)/backend/node_modules" || (echo "[make] ERROR: falta backend/node_modules"; exit 1)
	@test -f "$(TSX_CLI)" || (echo "[make] ERROR: falta tsx → cd backend && npm install"; exit 1)
	@printf '%s\n' "---- $$(date '+%Y-%m-%d %H:%M:%S') make run-backend-watch: tsx watch ----" > $(RUN_DIR)/backend.log
	@cd $(ROOT)/backend && \
	export PATH="$(BACKEND_NODE_BINDIR):$$PATH" && \
	nohup "$(NODE_BACKEND)" "$(TSX_CLI)" watch src/main.ts >> $(RUN_DIR)/backend.log 2>&1 & echo $$! > $(RUN_DIR)/backend.pid
	@echo "[make] Backend (watch) PID $$(cat $(RUN_DIR)/backend.pid) → backend.log"
	@$(WAIT_HTTP) "http://localhost:$(BACKEND_PORT)/api/health" "Nest API (:$(BACKEND_PORT))" $(BACKEND_HEALTH_ATTEMPTS) 1 || \
		(echo "[make] ERROR: API no respondió. Últimas líneas:"; tail -40 $(RUN_DIR)/backend.log; exit 1)

run-frontend: $(RUN_DIR)
	@if [ -z "$(NODE_FRONTEND)" ]; then \
		echo "[make] NODE_FRONTEND vacío: scripts/resolve-node-lts.sh o exporta NODE_FRONTEND=/ruta/node20/bin/node"; exit 1; \
	fi
	@FMAJOR=$$($(NODE_FRONTEND) -p "parseInt(process.versions.node,10)" 2>/dev/null); \
	if [ "$$FMAJOR" != "18" ] && [ "$$FMAJOR" != "20" ]; then \
		echo "[make] ERROR: Angular necesita Node 18 o 20 (ahora major=$$FMAJOR con $(NODE_FRONTEND))."; \
		echo "       export PATH=\"/opt/homebrew/opt/node@20/bin:\$$PATH\" o NODE_FRONTEND=/ruta/node20/bin/node"; \
		exit 1; \
	fi
	@if lsof -ti :$(FRONTEND_PORT) >/dev/null 2>&1; then \
		echo "[make] Puerto $(FRONTEND_PORT) ocupado"; exit 1; \
	fi
	@test -d "$(ROOT)/frontend/node_modules" || (echo "[make] ERROR: falta frontend/node_modules → cd frontend && npm install"; exit 1)
	@test -f "$(NG_CLI)" || (echo "[make] ERROR: falta Angular CLI ($(NG_CLI)) → cd frontend && npm install"; exit 1)
	@echo "" >> $(RUN_DIR)/frontend.log
	@echo "---- $$(date '+%Y-%m-%d %H:%M:%S') make run-frontend: $(NODE_FRONTEND) $$($(NODE_FRONTEND) -v 2>/dev/null) → ng.js serve :$(FRONTEND_PORT) ----" >> $(RUN_DIR)/frontend.log
	@echo "[make] Front: arrancando Angular en :$(FRONTEND_PORT) (primer build puede tardar 1–2 min)…"
	@cd $(ROOT)/frontend && \
	export PATH="$(FRONTEND_NODE_BINDIR):$$PATH" && \
	NODE_BIN="$(NODE_FRONTEND)"; \
	NG_CLI_ANALYTICS=false BROWSER=none nohup "$$NODE_BIN" ./node_modules/@angular/cli/bin/ng.js serve \
		--host localhost --port $(FRONTEND_PORT) \
		>> $(RUN_DIR)/frontend.log 2>&1 & echo $$! > $(RUN_DIR)/frontend.pid
	@echo "[make] Frontend PID $$(cat $(RUN_DIR)/frontend.pid) → frontend.log ($(NODE_FRONTEND) $$($(NODE_FRONTEND) -v 2>/dev/null))"
	@$(WAIT_HTTP) "http://localhost:$(FRONTEND_PORT)/" "Angular (:$(FRONTEND_PORT))" 180 1 || \
		(echo "[make] ERROR: el front no sirvió a tiempo. Revise frontend.log:"; tail -40 $(RUN_DIR)/frontend.log; exit 1)

# Sub-makes en serie: evita condiciones de carrera si ejecutas `make -j kill`.
kill:
	@$(MAKE) kill-frontend
	@$(MAKE) kill-backend
	@$(MAKE) kill-ml
	@echo "[make] Puertos $(ML_PORT)/$(BACKEND_PORT)/$(FRONTEND_PORT) liberados."

kill-ml:
	-@if [ -f $(RUN_DIR)/ml.pid ]; then kill $$(cat $(RUN_DIR)/ml.pid) 2>/dev/null || true; fi
	-@for p in $$(lsof -ti :$(ML_PORT) 2>/dev/null); do kill -9 $$p 2>/dev/null || true; done
	-@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	-@rm -f $(RUN_DIR)/ml.pid

kill-backend:
	-@if [ -f $(RUN_DIR)/backend.pid ]; then kill $$(cat $(RUN_DIR)/backend.pid) 2>/dev/null || true; fi
	-@for p in $$(lsof -ti :$(BACKEND_PORT) 2>/dev/null); do kill -9 $$p 2>/dev/null || true; done
	-@pkill -f "nest start" 2>/dev/null || true
	-@pkill -f "tsx watch" 2>/dev/null || true
	-@pkill -f "tsx src/main.ts" 2>/dev/null || true
	-@pkill -f "node dist/main.js" 2>/dev/null || true
	-@pkill -f "node_modules/.bin/tsc -p tsconfig.build.json" 2>/dev/null || true
	-@pkill -f "npm run start:dev" 2>/dev/null || true
	-@pkill -f "tsx/dist/cli.mjs watch src/main.ts" 2>/dev/null || true
	-@pkill -f "tsx/dist/cli.mjs src/main.ts" 2>/dev/null || true
	-@rm -f $(RUN_DIR)/backend.pid

kill-frontend:
	-@if [ -f $(RUN_DIR)/frontend.pid ]; then kill $$(cat $(RUN_DIR)/frontend.pid) 2>/dev/null || true; fi
	-@for p in $$(lsof -ti :$(FRONTEND_PORT) 2>/dev/null); do kill -9 $$p 2>/dev/null || true; done
	-@pkill -f "ng serve" 2>/dev/null || true
	-@rm -f $(RUN_DIR)/frontend.pid

restart:
	@$(MAKE) kill
	@sleep 1
	@$(MAKE) run

rerun:
	@$(MAKE) kill
	@sleep 2
	@$(MAKE) db-up
	@sleep 2
	@$(MAKE) run

db-up:
	@cd $(ROOT) && docker compose up -d postgres
	@echo "[make] Esperando a Postgres…"
	@cd $(ROOT) && \
		i=0; \
		while [ $$i -lt 45 ]; do \
			i=$$((i+1)); \
			docker compose exec -T postgres pg_isready -U novaretail -d novaretail >/dev/null 2>&1 && { echo "[make] Postgres listo."; exit 0; }; \
			sleep 2; \
		done; \
		echo "[make] AVISO: Postgres no respondió a pg_isready a tiempo; revisa \`docker compose logs postgres\`."

db-down:
	@cd $(ROOT) && docker compose stop postgres
