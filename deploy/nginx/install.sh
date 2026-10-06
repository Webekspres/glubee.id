#!/usr/bin/env bash
# Pasang vhost nginx Glubee + sertifikat Let's Encrypt (webroot). Jalankan sebagai root:
#   sudo bash /opt/glubee/nginx/install.sh
# Aman diulang: sertifikat hanya diminta bila belum ada; site lain tidak disentuh; selalu `nginx -t` sebelum reload.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Jalankan dengan sudo."; exit 1; }

DIR=$(cd "$(dirname "$0")" && pwd)
AVAIL=/etc/nginx/sites-available
ENABLED=/etc/nginx/sites-enabled
CERT=/etc/letsencrypt/live/glubee.id/fullchain.pem
BOOT=glubee-acme-bootstrap

reload() { nginx -t && systemctl reload nginx; }

DOMAINS=(glubee.id www.glubee.id api.glubee.id)
CERTBOT_ARGS=(certonly --webroot -w /var/www/certbot --cert-name glubee.id
  --non-interactive --agree-tos -m mk.webekspres@gmail.com --deploy-hook "systemctl reload nginx")
for d in "${DOMAINS[@]}"; do CERTBOT_ARGS+=(-d "$d"); done

for h in "${DOMAINS[@]}"; do
  getent ahostsv4 "$h" >/dev/null || { echo "DNS $h belum resolve. Tambahkan A record dulu."; exit 1; }
done

if [ ! -f "$CERT" ]; then
  echo "== Sertifikat belum ada: pasang vhost HTTP sementara untuk ACME"
  mkdir -p /var/www/certbot
  cat > "$AVAIL/$BOOT" <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name glubee.id www.glubee.id api.glubee.id;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 404; }
}
EOF
  ln -sf "$AVAIL/$BOOT" "$ENABLED/$BOOT"
  reload

  echo "== Minta sertifikat ${DOMAINS[*]}"
  certbot "${CERTBOT_ARGS[@]}"

  rm -f "$ENABLED/$BOOT" "$AVAIL/$BOOT"
fi

echo "== Pasang vhost final"
for site in glubee.id api.glubee.id; do
  install -m 644 "$DIR/$site.conf" "$AVAIL/$site"
  ln -sf "$AVAIL/$site" "$ENABLED/$site"
done
reload

# Sertifikat lama dibuat sebelum www ditambahkan: perluas bila daftar domain berubah (tanpa perubahan: no-op).
echo "== Pastikan sertifikat mencakup ${DOMAINS[*]}"
certbot "${CERTBOT_ARGS[@]}" --expand --keep-until-expiring
echo "Selesai."
