#!/usr/bin/env bash
# Prefiere Node 20 o 18 LTS (Angular / webpack suelen fallar con Node 22).
# Salida: ruta absoluta al binario `node`.

set -o pipefail
candidates=()
shopt -s nullglob
for p in "$HOME/.nvm/versions/node"/v20.*/bin/node \
  "$HOME/.nvm/versions/node"/v18.*/bin/node \
  /opt/homebrew/opt/node@20/bin/node \
  /usr/local/opt/node@20/bin/node \
  /opt/homebrew/opt/node@18/bin/node \
  /usr/local/opt/node@18/bin/node; do
  [[ -x "$p" ]] && candidates+=("$p")
done

if ((${#candidates[@]} > 0)); then
  for bin in "${candidates[@]}"; do
    ver="$("$bin" -v 2>/dev/null || true)"
    if [[ "$ver" == v20.* || "$ver" == v18.* ]]; then
      printf '%s' "$bin"
      exit 0
    fi
  done
fi

n="$(command -v node 2>/dev/null || true)"
if [[ -n "$n" ]]; then
  maj="$("$n" -p "parseInt(process.versions.node,10)" 2>/dev/null || echo 99)"
  if [[ "$maj" == "18" || "$maj" == "20" ]]; then
    printf '%s' "$n"
    exit 0
  fi
  echo "resolve-node-lts: el \`node\` del PATH es v$("$n" -v 2>/dev/null) (major=$maj); se recomienda Node 18 o 20 para Angular." >&2
fi

[[ -n "$n" ]] && printf '%s' "$n" || printf '%s' "node"
