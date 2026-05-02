#!/usr/bin/env bash
# ── Codera AI — Start Script ──────────────────────────────────────────────────
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI="$ROOT/cc-ui"

# Install dependencies if node_modules missing
if [ ! -d "$UI/node_modules" ]; then
  echo "📦  Abhängigkeiten installieren…"
  cd "$UI" && npm install
fi

echo "🚀  Codera AI startet auf http://localhost:2002"
cd "$UI" && npm run dev
