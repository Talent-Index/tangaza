#!/usr/bin/env bash
#
# Apply Ubu-Tangaza DB migrations in order. Schema migrations are idempotent
# (create table / add column "if not exists"), so re-running is safe.
#
# Usage — pass the connection string as an env var (keeps it out of shell history/logs):
#
#   DATABASE_URL="postgres://…"  bash web/scripts/migrate.sh          # all migrations
#   DATABASE_URL="postgres://…"  bash web/scripts/migrate.sh 011 012  # only these
#
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to your Neon/Postgres connection string}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
db="$here/../db"

# With args, apply only migrations whose filename starts with one of the given prefixes
# (e.g. "011" "012"). With none, apply every db/*.sql in order.
select_files() {
  if [ "$#" -eq 0 ]; then
    ls "$db"/*.sql | sort
  else
    for p in "$@"; do ls "$db/${p}"*.sql 2>/dev/null; done | sort -u
  fi
}

mapfile -t files < <(select_files "$@")
[ "${#files[@]}" -gt 0 ] || { echo "No migration files matched." >&2; exit 1; }

for f in "${files[@]}"; do
  echo "→ applying $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "✓ done (${#files[@]} file(s))"
