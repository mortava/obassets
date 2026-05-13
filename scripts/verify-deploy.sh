#!/usr/bin/env bash
# verify-deploy.sh — probe a deployed portal URL to confirm the production
# build is healthy and the Encompass adapter path is reachable.
#
# Usage:
#   scripts/verify-deploy.sh https://your-deploy.vercel.app
#   scripts/verify-deploy.sh https://your-deploy.vercel.app --with-edc-test
#
# The optional --with-edc-test flag sends a POST to the connection-test
# endpoint with intentionally-invalid credentials. A 401/403 response is
# the success case — it proves the production adapter is wired up and
# actually reaching ICE. Use real credentials only via dashboard env vars,
# never in a script.
#
# Exit codes:
#   0 = all probes returned the expected shape
#   1 = at least one probe failed

set -euo pipefail

BASE="${1:-}"
WITH_EDC="${2:-}"

if [[ -z "${BASE}" ]]; then
  echo "Usage: $0 <https://deploy-url> [--with-edc-test]" >&2
  exit 2
fi
BASE="${BASE%/}"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

bold "Probing ${BASE}"
echo

fails=0

probe() {
  local label="$1" method="$2" path="$3" expect_status="$4" data="${5:-}"
  local url="${BASE}${path}"
  local args=(-sS -o /tmp/probe.body -w '%{http_code}|%{time_total}' -X "${method}" --max-time 20)
  if [[ -n "${data}" ]]; then
    args+=(-H 'content-type: application/json' -d "${data}")
  fi
  local out status time
  out="$(curl "${args[@]}" "${url}" 2>/tmp/probe.err)" || true
  status="${out%%|*}"
  time="${out##*|}"

  if [[ "${status}" == "${expect_status}" ]]; then
    green "✓ ${label}  ${method} ${path}  → ${status} (${time}s)"
    head -c 200 /tmp/probe.body 2>/dev/null | sed 's/^/    /'
    echo
  else
    red "✗ ${label}  ${method} ${path}  → ${status} (expected ${expect_status})"
    head -c 400 /tmp/probe.body 2>/dev/null | sed 's/^/    /'
    cat /tmp/probe.err 2>/dev/null | sed 's/^/    /'
    echo
    fails=$((fails + 1))
  fi
}

probe "Healthz"                "GET"  "/api/healthz"                            200
probe "Connections status"     "GET"  "/api/connections/encompass/status"       200
probe "Dashboard root"         "GET"  "/"                                       200
probe "Connections page"       "GET"  "/connections"                            200
probe "Wizard page"            "GET"  "/new"                                    200
probe "Test endpoint (empty)"  "POST" "/api/connections/encompass/test"         400 '{}'

if [[ "${WITH_EDC}" == "--with-edc-test" ]]; then
  # Send invalid creds — expect 401/403 from upstream EDC, surfaced cleanly
  probe "Test endpoint (bad creds → ICE 4xx)" \
    "POST" "/api/connections/encompass/test" 403 \
    '{"env":"sandbox","grantType":"client_credentials","clientId":"intentionally_invalid","clientSecret":"intentionally_invalid"}'
fi

echo
if [[ ${fails} -eq 0 ]]; then
  green "All probes passed."
  exit 0
else
  red "${fails} probe(s) failed."
  exit 1
fi
