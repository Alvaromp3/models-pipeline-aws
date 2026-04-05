#!/usr/bin/env bash
# Elige un binario de Node que pueda cargar `pg` (Node 22 suele romper el driver).
# Uso: export NODE_BACKEND="$(./scripts/resolve-node-backend.sh)"
# Salida: ruta absoluta al binario. Si ninguno sirve, sale con 1 (no devuelve `node` genérico:
# Make usaría entonces npm/tsc con Node 22 del PATH).

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"

test_pg() {
  local bin="$1"
  [[ -x "$bin" ]] 2>/dev/null || return 1
  (cd "$BACKEND" && "$bin" -e "require('pg')" >/dev/null 2>&1)
}

candidates=()
if [[ -n "${NODE_BACKEND:-}" && "${NODE_BACKEND}" != "node" ]]; then
  candidates+=("$NODE_BACKEND")
fi
# Probar Node 20 antes que `node` del PATH (a menudo v22): pg + Nest son más estables en 20.
shopt -s nullglob
for p in "$HOME/.nvm/versions/node"/v20.*/bin/node \
  /opt/homebrew/opt/node@20/bin/node \
  /usr/local/opt/node@20/bin/node; do
  [[ -x "$p" ]] && candidates+=("$p")
done
if command -v node >/dev/null 2>&1; then
  candidates+=("$(command -v node)")
fi

seen=""
for bin in "${candidates[@]}"; do
  [[ -n "$bin" ]] || continue
  case " $seen " in *" $bin "*) continue ;; esac
  seen+=" $bin "
  if test_pg "$bin"; then
    printf '%s' "$bin"
    exit 0
  fi
done

echo "resolve-node-backend: ningún Node pudo cargar \`pg\` en backend/ (¿Node 22? ¿npm install en backend?)." >&2
echo "Instala Node 20 LTS (brew install node@20) o: export NODE_BACKEND=/ruta/a/node20/bin/node" >&2
exit 1
