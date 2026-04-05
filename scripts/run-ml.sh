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

if [[ ! -x .venv/bin/python3 ]]; then
  echo "[run-ml.sh] ERROR: falta .venv/bin/python3. En ml-service: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

echo "[run-ml.sh] $(date '+%Y-%m-%d %H:%M:%S') lanzando uvicorn (python -m)…"
exec .venv/bin/python3 -u -m uvicorn app.main:app --host 0.0.0.0 --port "$ML_PORT" --log-level info
