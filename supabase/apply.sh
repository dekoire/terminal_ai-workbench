#!/usr/bin/env bash
# =============================================================================
# Codera AI — Apply Supabase Schema + Seed
# Usage: SUPABASE_SERVICE_KEY=<key> ./apply.sh [admin-email]
# =============================================================================
set -euo pipefail

PROJECT_REF="fpphqkuizptypeawclsx"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
SERVICE_KEY="${SUPABASE_SERVICE_KEY:-}"
ADMIN_EMAIL="${1:-}"

if [[ -z "$SERVICE_KEY" ]]; then
  echo "❌  Set SUPABASE_SERVICE_KEY env var first"
  echo "    export SUPABASE_SERVICE_KEY=<service_role_key>"
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"

run_sql() {
  local file="$1"
  echo "▶ Applying $file …"
  curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(jq -Rs . < "$file")}" \
    | jq -r '.error // "✅  Done"'
}

# Fallback: use pg_exec (available on Supabase projects)
run_sql_pg() {
  local file="$1"
  echo "▶ Applying $file via pg_exec …"
  curl -s -X POST \
    "${SUPABASE_URL}/pg/query" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(jq -Rs . < "$file")}" \
    | python3 -c "import json,sys; r=json.load(sys.stdin); print(r.get('error') or '✅  Done')"
}

echo ""
echo "═══════════════════════════════════════"
echo " Codera AI — Supabase Migration"
echo " Project: ${PROJECT_REF}"
echo "═══════════════════════════════════════"
echo ""

echo "1/2  Applying schema …"
run_sql_pg "${DIR}/migrations/001_initial_schema.sql" || run_sql "${DIR}/migrations/001_initial_schema.sql"

echo ""
echo "2/2  Seeding default data …"
run_sql_pg "${DIR}/seed.sql" || run_sql "${DIR}/seed.sql"

echo ""
if [[ -n "$ADMIN_EMAIL" ]]; then
  echo "3/3  Looking up admin user: $ADMIN_EMAIL …"
  USER_ID=$(curl -s \
    "${SUPABASE_URL}/auth/v1/admin/users?email=${ADMIN_EMAIL}" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    | python3 -c "import json,sys; users=json.load(sys.stdin).get('users',[]); print(users[0]['id'] if users else '')")

  if [[ -z "$USER_ID" ]]; then
    echo "⚠   User not found. Create them first at ${SUPABASE_URL}/dashboard"
  else
    echo "    User ID: $USER_ID"
    curl -s -X POST \
      "${SUPABASE_URL}/rest/v1/admin_users" \
      -H "apikey: ${SERVICE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "{\"user_id\": \"${USER_ID}\"}"
    echo "✅  Admin user created!"
  fi
fi

echo ""
echo "═══════════════════════════════════════"
echo " Complete — open Supabase Dashboard"
echo " ${SUPABASE_URL}/project/${PROJECT_REF}/editor"
echo "═══════════════════════════════════════"
