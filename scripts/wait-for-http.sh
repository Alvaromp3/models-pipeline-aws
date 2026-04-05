#!/usr/bin/env bash
# Espera a que una URL HTTP responda 2xx (curl -sf).
# Uso: wait-for-http.sh URL nombre [intentos] [segundos_entre] [max_time_curl]
set -uo pipefail
url="${1:?URL}"
name="${2:-servicio}"
max="${3:-45}"
delay="${4:-1}"
# Servicios con /health lento (S3) o arranque pesado: p. ej. 10–15.
curl_max="${5:-5}"

for ((i = 1; i <= max; i++)); do
  if ((i == 1)) || ((i % 30 == 0)); then
    printf '[wait-for-http] %s intento %s/%s (%s)\n' "$name" "$i" "$max" "$url" >&2
  fi
  # URLs con `localhost`: primero IPv4 (-4) para 0.0.0.0; luego sin -4 por ::1.
  if curl -4 -sfS --connect-timeout 2 --max-time "$curl_max" "$url" >/dev/null 2>&1 \
    || curl -sfS --connect-timeout 2 --max-time "$curl_max" "$url" >/dev/null 2>&1; then
    printf '[wait-for-http] %s OK (%s)\n' "$name" "$url" >&2
    exit 0
  fi
  sleep "$delay"
done

printf '[wait-for-http] TIMEOUT: %s no respondió en %s intentos: %s\n' "$name" "$max" "$url" >&2
exit 1
