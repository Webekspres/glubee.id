#!/usr/bin/env bash
# Membuat POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, CRON_SECRET untuk /opt/glubee/.env.
# Hasil dicetak ke stdout; salin manual ke .env. Jangan jalankan ulang di environment yang sudah berisi data:
# JWT_SECRET baru membatalkan semua sesi, dan POSTGRES_PASSWORD baru tidak mengubah password role yang sudah ada.
set -euo pipefail

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

sign() {
  local secret=$1 role=$2 now exp header payload
  now=$(date +%s)
  exp=$((now + 10 * 365 * 24 * 3600))
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%d,"exp":%d}' "$role" "$now" "$exp" | b64url)
  printf '%s.%s.%s' "$header" "$payload" \
    "$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -hmac "$secret" -binary | b64url)"
}

jwt_secret=$(openssl rand -hex 32)
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
echo "JWT_SECRET=$jwt_secret"
echo "ANON_KEY=$(sign "$jwt_secret" anon)"
echo "SERVICE_ROLE_KEY=$(sign "$jwt_secret" service_role)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
