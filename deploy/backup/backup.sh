#!/usr/bin/env bash
# Backup harian terenkripsi ke Google Drive (ADR-0001, SRS §10.2).
#
#   backup.sh <domain> <stack-dir>
#   contoh (cron adminweb, TZ server WIB):  0 2 * * * /opt/glubee/backup/backup.sh glubee.id /opt/glubee
#
# Konfigurasi dibaca dari <stack-dir>/.env:
#   BACKUP_AGE_RECIPIENT  public key age (age1...). Private key TIDAK boleh ada di VPS.
#   BACKUP_RCLONE_REMOTE  nama remote rclone, mis. gdrive
#   BACKUP_KEEP           jumlah versi yang disimpan (default 7)
#   BACKUP_DB_CONTAINER   container Postgres (default glubee-db-1)
#   HC_PING_URL           ping URL Healthchecks.io (opsional, tapi wajib di production)
#
# Hasil: <remote>:backup website/<domain>/<dd-mm-yyyy-HHmm>/<domain>.dump.age
# Restore: age -d -i key.txt <file> > db.dump && pg_restore ... (lihat deploy/README.md)
set -Eeuo pipefail

DOMAIN=${1:?pakai: backup.sh <domain> <stack-dir>}
STACK=${2:?pakai: backup.sh <domain> <stack-dir>}
LOG="$STACK/backup/backup.log"
mkdir -p "$(dirname "$LOG")"
exec > >(tee -a "$LOG") 2>&1

get() { grep -E "^$1=" "$STACK/.env" | tail -n 1 | cut -d= -f2- || true; }
RECIPIENT=$(get BACKUP_AGE_RECIPIENT)
REMOTE=$(get BACKUP_RCLONE_REMOTE)
KEEP=$(get BACKUP_KEEP); KEEP=${KEEP:-7}
DB=$(get BACKUP_DB_CONTAINER); DB=${DB:-glubee-db-1}
HC=$(get HC_PING_URL)

# Ping gagal tidak boleh menggagalkan backup.
ping_hc() { [ -z "$HC" ] || curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "${2:-}" "$HC$1" || true; }

TMP=$(mktemp -d)
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT
trap 'rc=$?; echo "[$(date "+%F %T")] GAGAL (exit $rc) di baris $LINENO"; ping_hc /fail "$(tail -c 1000 "$LOG")"; exit $rc' ERR

echo "[$(date "+%F %T")] mulai backup $DOMAIN"
[ -n "$RECIPIENT" ] || { echo "BACKUP_AGE_RECIPIENT kosong"; false; }
[ -n "$REMOTE" ] || { echo "BACKUP_RCLONE_REMOTE kosong"; false; }
ping_hc /start

STAMP=$(date +%d-%m-%Y-%H%M)
BASE="$REMOTE:backup website/$DOMAIN"
FILE="$TMP/$DOMAIN.dump.age"

# Dump format custom (mencakup schema auth + public), langsung dienkripsi; plaintext tidak pernah menyentuh disk.
docker exec "$DB" pg_dump -U postgres -Fc postgres | age -r "$RECIPIENT" > "$FILE"
SIZE=$(stat -c %s "$FILE")
[ "$SIZE" -gt 1024 ] || { echo "hasil dump terlalu kecil ($SIZE byte)"; false; }

rclone copyto "$FILE" "$BASE/$STAMP/$DOMAIN.dump.age"
echo "terunggah: $BASE/$STAMP ($SIZE byte)"

# Rotasi: nama folder dd-mm-yyyy-HHmm tidak urut secara leksikal, jadi diurutkan lewat kunci yyyymmddHHMM.
mapfile -t OLD < <(
  rclone lsf --dirs-only "$BASE" | sed 's#/$##' |
    awk -F- 'NF==4 {print $3 $2 $1 $4 " " $0}' | sort -r | tail -n +"$((KEEP + 1))" | cut -d" " -f2
)
for d in "${OLD[@]}"; do
  rclone purge "$BASE/$d"
  echo "dihapus (rotasi): $d"
done

ping_hc "" "ok $STAMP $SIZE byte"
echo "[$(date "+%F %T")] selesai"
