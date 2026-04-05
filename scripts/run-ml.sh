#!/usr/bin/env bash
# Arranque ML desde make: logs inmediatos, .env opcional, sin set -u (evita salidas silenciosas al source .env).
ROOT="${ROOT:?ROOT vacío}"
ML_PORT="${ML_PORT:-8000}"
cd "$ROOT/ml-service" || {
  echo "[run-ml.sh] ERROR: no existe $ROOT/ml-service"
  exit 1
}

echo "[run-ml.sh] $(date '+%Y-%m-%d %H:%M:%S') cwd=$PWD port=$ML_PORT"

export PYTHONUNBUFFERED=1
export PYDANTIC_DISABLE_PLUGINS=1
export AWS_EC2_METADATA_DISABLED="${AWS_EC2_METADATA_DISABLED:-true}"

if [[ -f .env ]]; then
  set +u
  set -a
  # shellcheck disable=SC1091
  source .env 2>/dev/null || true
  set +a
fi

if [[ -x .venv/bin/python3 ]]; then
  PY=.venv/bin/python3
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
  echo "[run-ml.sh] AVISO: usando python3 del PATH (crea .venv en ml-service para entorno aislado)."
else
  echo "[run-ml.sh] ERROR: no hay .venv/bin/python3 ni python3 en PATH."
  exit 1
fi

echo "[run-ml.sh] $(date '+%Y-%m-%d %H:%M:%S') lanzando uvicorn con $PY…"
exec "$PY" -u -m uvicorn app.main:app --host 0.0.0.0 --port "$ML_PORT" --log-level info
