#!/usr/bin/env bash
# Creates admin user: admin@codera.com / 123 / Nael Ahmed
# Usage: SUPABASE_SERVICE_KEY=<service_role_key> ./create-admin.sh
set -euo pipefail

PROJECT_REF="fpphqkuizptypeawclsx"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
SERVICE_KEY="${SUPABASE_SERVICE_KEY:-}"

if [[ -z "$SERVICE_KEY" ]]; then
  echo "❌  Set SUPABASE_SERVICE_KEY env var first"
  echo "    Dashboard → Settings → API → service_role key"
  echo "    https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
  exit 1
fi

echo "▶ Creating admin user admin@codera.com …"

RESULT=$(curl -s -X POST \
  "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@codera.com",
    "password": "123456",
    "email_confirm": true,
    "user_metadata": {
      "first_name": "Nael",
      "last_name": "Ahmed"
    }
  }')

USER_ID=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || true)

if [[ -z "$USER_ID" ]]; then
  echo "⚠   Response: $RESULT"
  echo "    User may already exist — trying to find them …"
  USER_ID=$(curl -s \
    "${SUPABASE_URL}/auth/v1/admin/users?email=admin@codera.com" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    | python3 -c "import json,sys; u=json.load(sys.stdin).get('users',[]); print(u[0]['id'] if u else '')" 2>/dev/null || true)
fi

if [[ -z "$USER_ID" ]]; then
  echo "❌  Could not create or find user"
  exit 1
fi

echo "✅  User ID: $USER_ID"
echo ""
echo "═══════════════════════════════════════════"
echo " Admin user ready:"
echo " Email:    admin@codera.com"
echo " Password: 123456"
echo " Name:     Nael Ahmed"
echo "═══════════════════════════════════════════"
echo ""
echo "Next: copy your anon key from:"
echo "https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
echo "→ Settings → Integrationen → Datenbank → Anon Key"
