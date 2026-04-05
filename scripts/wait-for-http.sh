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

# Si la URL es http://127.0.0.1:PUERTO/…, probar también localhost y ::1 (macOS / ng serve --host localhost).
urls_to_try=("$url")
if [[ "$url" =~ ^http://127\.0\.0\.1:([0-9]+)(/.*)?$ ]]; then
  _port="${BASH_REMATCH[1]}"
  _path="${BASH_REMATCH[2]:-/}"
  [[ "$_path" == "" ]] && _path="/"
  urls_to_try=(
    "http://127.0.0.1:${_port}${_path}"
    "http://localhost:${_port}${_path}"
    "http://[::1]:${_port}${_path}"
  )
fi

_curl_ok() {
  local u="$1"
  # Primero IPv4 explícito; luego sin -4 (puede usar IPv6 o resolución del sistema).
  curl -4 -sfS --connect-timeout 3 --max-time "$curl_max" "$u" >/dev/null 2>&1 \
    || curl -sfS --connect-timeout 3 --max-time "$curl_max" "$u" >/dev/null 2>&1
}

for ((i = 1; i <= max; i++)); do
  if ((i == 1)) || ((i % 30 == 0)); then
    printf '[wait-for-http] %s intento %s/%s (base %s)\n' "$name" "$i" "$max" "$url" >&2
  fi
  for tryurl in "${urls_to_try[@]}"; do
    if _curl_ok "$tryurl"; then
      printf '[wait-for-http] %s OK (%s)\n' "$name" "$tryurl" >&2
      exit 0
    fi
  done
  sleep "$delay"
done

printf '[wait-for-http] TIMEOUT: %s no respondió en %s intentos: %s\n' "$name" "$max" "$url" >&2
exit 1
