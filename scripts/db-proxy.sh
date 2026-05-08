#!/usr/bin/env bash
# Start the Cloud SQL Auth Proxy locally and run a DB command against it.
#
# Usage:
#   bash scripts/db-proxy.sh migrate   # default — runs `npm run migrate`
#   bash scripts/db-proxy.sh seed      # runs `npm run seed`
#   bash scripts/db-proxy.sh shell     # opens an interactive mysql shell
#   bash scripts/db-proxy.sh start     # just starts proxy and waits (Ctrl-C to stop)
#
# Prereqs:
#   gcloud auth login
#   gcloud auth application-default login
#   The active account needs `roles/cloudsql.client` and `roles/secretmanager.secretAccessor`
#   on the project that owns the Cloud SQL instance and the `db-password` secret.
#
# Env overrides:
#   CLOUDSQL_INSTANCE  default dzz3hc:asia-east1:dzz3
#   DB_NAME            default dzz3activity
#   DB_USER            default dbadmin
#   DB_PORT            default 3306
#   DB_PASSWORD_SECRET default db-password (Secret Manager secret name)
#   DB_PASSWORD        if set, used directly (skip Secret Manager)
#   CLOUD_SQL_PROXY    path to a cloud-sql-proxy v2 binary (auto-downloaded if absent)

set -euo pipefail

CLOUDSQL_INSTANCE="${CLOUDSQL_INSTANCE:-dzz3hc:asia-east1:dzz3}"
DB_NAME="${DB_NAME:-dzz3activity}"
DB_USER="${DB_USER:-dbadmin}"
DB_PORT="${DB_PORT:-3306}"
SECRET_NAME="${DB_PASSWORD_SECRET:-db-password}"
PROXY_VERSION="v2.13.0"

cmd="${1:-migrate}"

err() { printf '\033[31m%s\033[0m\n' "$*" >&2; }
info() { printf '\033[36m%s\033[0m\n' "$*"; }
ok() { printf '\033[32m%s\033[0m\n' "$*"; }

# 1) gcloud must have an active account.
if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
  err "No active gcloud account. Run: gcloud auth login"
  exit 1
fi

# 2) Application Default Credentials must exist.
#    Discovery order: $GOOGLE_APPLICATION_CREDENTIALS → standard ~/.config path
#    → search /tmp + ~/.config (Cloud Shell stashes ADC under /tmp/tmp.XXXX/).
ADC_PATH=""
if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" && -f "$GOOGLE_APPLICATION_CREDENTIALS" ]]; then
  ADC_PATH="$GOOGLE_APPLICATION_CREDENTIALS"
elif [[ -f "$HOME/.config/gcloud/application_default_credentials.json" ]]; then
  ADC_PATH="$HOME/.config/gcloud/application_default_credentials.json"
else
  ADC_PATH="$(find /tmp "$HOME/.config" -name application_default_credentials.json 2>/dev/null | head -n 1 || true)"
fi
if [[ -z "$ADC_PATH" || ! -f "$ADC_PATH" ]]; then
  err "Application Default Credentials not found."
  err "Run: gcloud auth application-default login"
  exit 1
fi
# Sanity-check the creds actually mint a token (catches expired/revoked ADC).
if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then
  err "ADC at $ADC_PATH cannot mint an access token (expired or revoked)."
  err "Run: gcloud auth application-default login"
  exit 1
fi

# 3) cloud-sql-proxy v2 binary — use PATH if present, else download to ~/.local/bin.
PROXY_BIN="${CLOUD_SQL_PROXY:-}"
if [[ -z "$PROXY_BIN" ]]; then
  PROXY_BIN="$(command -v cloud-sql-proxy || true)"
fi
if [[ -z "$PROXY_BIN" ]]; then
  PROXY_BIN="$HOME/.local/bin/cloud-sql-proxy"
  if [[ ! -x "$PROXY_BIN" ]]; then
    info "→ downloading cloud-sql-proxy ${PROXY_VERSION} to $PROXY_BIN"
    mkdir -p "$(dirname "$PROXY_BIN")"
    OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
    ARCH="$(uname -m)"
    case "$ARCH" in
      x86_64|amd64) ARCH=amd64 ;;
      aarch64|arm64) ARCH=arm64 ;;
      *) err "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    URL="https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/${PROXY_VERSION}/cloud-sql-proxy.${OS}.${ARCH}"
    curl -fsSL "$URL" -o "$PROXY_BIN"
    chmod +x "$PROXY_BIN"
  fi
fi

# 4) Resolve DB_PASSWORD from Secret Manager unless caller already provided one.
if [[ -z "${DB_PASSWORD:-}" ]]; then
  info "→ fetching DB password from Secret Manager: ${SECRET_NAME}"
  if ! DB_PASSWORD="$(gcloud secrets versions access latest --secret="$SECRET_NAME" 2>/dev/null)"; then
    err "Failed to access secret '${SECRET_NAME}'."
    err "Grant roles/secretmanager.secretAccessor on the secret, or pass DB_PASSWORD inline."
    exit 1
  fi
  export DB_PASSWORD
fi

# 5) Bail early if the local port is already in use — avoids the silent ETIMEDOUT.
if (echo > "/dev/tcp/127.0.0.1/${DB_PORT}") >/dev/null 2>&1; then
  err "Port ${DB_PORT} is already in use on 127.0.0.1."
  err "Stop the other listener or set DB_PORT=<free-port> and re-run."
  exit 1
fi

# 6) Start proxy in the background, with cleanup on exit.
PROXY_LOG="$(mktemp)"
"$PROXY_BIN" --credentials-file "$ADC_PATH" --port "$DB_PORT" "$CLOUDSQL_INSTANCE" \
  >"$PROXY_LOG" 2>&1 &
PROXY_PID=$!
cleanup() {
  if kill -0 "$PROXY_PID" 2>/dev/null; then
    kill "$PROXY_PID" 2>/dev/null || true
    wait "$PROXY_PID" 2>/dev/null || true
  fi
  rm -f "$PROXY_LOG"
}
trap cleanup EXIT INT TERM

# 7) Wait for the proxy to report ready (or die).
printf '→ starting Cloud SQL Auth Proxy on 127.0.0.1:%s ' "$DB_PORT"
ready=0
for _ in $(seq 1 30); do
  if grep -q "ready for new connections" "$PROXY_LOG" 2>/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$PROXY_PID" 2>/dev/null; then
    printf '\n'
    err "proxy exited before becoming ready. Log:"
    cat "$PROXY_LOG" >&2
    exit 1
  fi
  printf '.'
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  printf '\n'
  err "proxy did not become ready within 30s. Log:"
  cat "$PROXY_LOG" >&2
  exit 1
fi
ok "✓"

export DB_HOST=127.0.0.1
export DB_PORT DB_USER DB_NAME DB_PASSWORD

case "$cmd" in
  migrate)
    npm run migrate
    ;;
  seed)
    npm run seed
    ;;
  shell)
    if ! command -v mysql >/dev/null 2>&1; then
      err "mysql client not found. Install with: sudo apt-get install -y default-mysql-client"
      exit 1
    fi
    MYSQL_PWD="$DB_PASSWORD" mysql -h 127.0.0.1 -P "$DB_PORT" -u "$DB_USER" "$DB_NAME"
    ;;
  start)
    info "Proxy is running on 127.0.0.1:${DB_PORT}. Press Ctrl-C to stop."
    wait "$PROXY_PID"
    ;;
  *)
    shift || true
    if [[ $# -eq 0 ]]; then
      err "Unknown command: $cmd"
      err "Use one of: migrate | seed | shell | start | <custom command...>"
      exit 1
    fi
    "$@"
    ;;
esac
