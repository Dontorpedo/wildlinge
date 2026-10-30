#!/usr/bin/env bash
# Installs or updates the Plimploms server on Ubuntu 24.04 (run as root).
# Usage: sudo ./install.sh [--domain example.com] [--email you@example.com] [--port 80]
set -euo pipefail

DOMAIN="_"
EMAIL=""
PORT="80"
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done
[ "$(id -u)" -eq 0 ] || { echo "Please run as root (sudo)." >&2; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -x "$HERE/wildlinge-server" ] && [ -f "$HERE/wildlinge.html" ] || { echo "wildlinge-server or wildlinge.html missing next to install.sh" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx >/dev/null

id wildlinge >/dev/null 2>&1 || useradd --system --home /var/lib/wildlinge --shell /usr/sbin/nologin wildlinge
install -d -o wildlinge -g wildlinge -m 750 /var/lib/wildlinge
install -d -m 755 /opt/wildlinge /var/www/wildlinge /var/backups/wildlinge

systemctl stop wildlinge 2>/dev/null || true
install -m 755 "$HERE/wildlinge-server" /opt/wildlinge/wildlinge-server
install -m 644 "$HERE/wildlinge.html" /var/www/wildlinge/index.html
[ -d "$HERE/static" ] && install -m 644 "$HERE"/static/* /var/www/wildlinge/
install -m 644 "$HERE/wildlinge.service" /etc/systemd/system/wildlinge.service

if [ ! -f /etc/wildlinge.env ]; then
  if [ "$DOMAIN" != "_" ] && [ -n "$EMAIL" ]; then
    echo "WL_ORIGIN=https://$DOMAIN" > /etc/wildlinge.env
  else
    : > /etc/wildlinge.env
  fi
fi

sed -e "s/@DOMAIN@/$DOMAIN/" -e "s/@PORT@/$PORT/" "$HERE/nginx.conf.template" > /etc/nginx/sites-available/wildlinge
ln -sf /etc/nginx/sites-available/wildlinge /etc/nginx/sites-enabled/wildlinge
if [ "$DOMAIN" = "_" ] && [ "$PORT" = "80" ]; then rm -f /etc/nginx/sites-enabled/default; fi
nginx -t

cat > /etc/cron.daily/wildlinge-backup <<'CRON'
#!/bin/sh
d=/var/backups/wildlinge
[ -f /var/lib/wildlinge/world.json.gz ] && cp /var/lib/wildlinge/world.json.gz "$d/world-$(date +%F).json.gz"
[ -f /var/lib/wildlinge/terraria.json.gz ] && cp /var/lib/wildlinge/terraria.json.gz "$d/terraria-$(date +%F).json.gz"
find "$d" -type f -mtime +7 -delete
CRON
chmod 755 /etc/cron.daily/wildlinge-backup

systemctl daemon-reload
systemctl enable --now wildlinge
systemctl reload nginx

if [ "$DOMAIN" != "_" ] && [ -n "$EMAIL" ]; then
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --redirect -n || echo "certbot failed: check that the DNS record of $DOMAIN points to this server, then run the command again."
fi

sleep 2
systemctl --no-pager --lines=5 status wildlinge || true
echo
echo "Done. Open: http://${DOMAIN/_/<server-ip>}:$PORT/"
echo "Logs:   journalctl -u wildlinge -f"
echo "Data:   /var/lib/wildlinge (backups in /var/backups/wildlinge)"
