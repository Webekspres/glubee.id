#!/usr/bin/env bash
# Panggil dispatcher pengingat (GLB-019) tiap menit dari crontab adminweb:
#   * * * * * /opt/glubee/cron/dispatch.sh /opt/glubee
# Langsung ke app di 127.0.0.1 (nginx menolak /api/internal/ dari luar). Secret dikirim
# lewat file deskriptor agar tidak terlihat di `ps`. Log hanya baris yang gagal.
set -uo pipefail

STACK=${1:?pakai: dispatch.sh <stack-dir>}
get() { grep -E "^$1=" "$STACK/.env" | tail -n 1 | cut -d= -f2- || true; }
SECRET=$(get CRON_SECRET)
PORT=$(get APP_HOST_PORT); PORT=${PORT:-3000}
[ "${#SECRET}" -ge 32 ] || exit 0

out=$(curl -sS -m 55 -X POST "http://127.0.0.1:$PORT/api/internal/jobs/dispatch" \
  -H "Content-Type: application/json" -H @<(printf 'Authorization: Bearer %s\n' "$SECRET") \
  -d '{}' -w '\n%{http_code}' 2>&1)
code=${out##*$'\n'}
[ "$code" = "200" ] || echo "[$(date '+%F %T')] dispatch $code ${out%$'\n'*}" | cut -c1-300 >> "$STACK/cron/dispatch.log"
