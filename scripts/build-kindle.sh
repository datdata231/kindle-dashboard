#!/usr/bin/env bash
# Build kindle/ — the folders to copy onto a jailbroken Kindle Paperwhite 3/4 over USB:
#   kindle/dashboard/            → <Kindle USB root>/dashboard
#   kindle/extensions/kindle-dash → <Kindle USB root>/extensions/kindle-dash   (KUAL menu entry)
# Based on pascalw/kindle-dash, with the Paperwhite fixes from issue #25
# (framework stop + /dev/rtc1 wake-up); nothing else from that fork is used.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="v1.0.0-beta.4"
[ -f .kindle-url ] || { echo "Chưa có .kindle-url — chạy scripts/setup.sh trước."; exit 1; }
URL="$(cat .kindle-url)"

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
curl -fsSL "https://github.com/pascalw/kindle-dash/releases/download/$VERSION/kindle-dash-$VERSION.tgz" -o "$WORK/kd.tgz"
mkdir "$WORK/x" && tar -xzf "$WORK/kd.tgz" -C "$WORK/x"
SRC="$(dirname "$(find "$WORK/x" -name dash.sh -type f | head -1)")"
[ -f "$SRC/start.sh" ] || { echo "Không tìm thấy start.sh trong bản phát hành"; exit 1; }

rm -rf kindle && mkdir -p kindle/dashboard kindle/extensions
cp -R "$SRC/." kindle/dashboard/

# --- Paperwhite patches ---------------------------------------------------
DASH=kindle/dashboard/dash.sh
grep -q '/etc/init.d/framework stop' "$DASH" || { echo "dash.sh đã đổi — cần xem lại bản vá"; exit 1; }
perl -0pi -e 's#  /etc/init.d/framework stop#  stop framework 2>/dev/null || /etc/init.d/framework stop\n  stop lab126_gui 2>/dev/null || true#' "$DASH"
perl -0pi -e 's#    \[ "\$\(cat "\$RTC"\)" -eq 0 \] && echo -n "\$duration" >"\$RTC"#    if [ -e "\$RTC" ]; then\n      [ "\$(cat "\$RTC")" -eq 0 ] && echo -n "\$duration" >"\$RTC"\n    else\n      rtcwake -d /dev/rtc1 -m no -s "\$duration"\n    fi#' "$DASH"
grep -q 'rtcwake -d /dev/rtc1' "$DASH" && grep -q 'stop lab126_gui' "$DASH" || { echo "Vá dash.sh thất bại"; exit 1; }

# --- Local config -----------------------------------------------------------
cat > kindle/dashboard/local/fetch-dashboard.sh <<EOF
#!/usr/bin/env sh
# Fetch the dashboard PNG rendered by GitHub Actions into "\$1".
"\$(dirname "\$0")/../xh" -d -q -o "\$1" get "$URL"
EOF
cat > kindle/dashboard/local/env.sh <<'EOF'
#!/usr/bin/env sh
export WIFI_TEST_IP=${WIFI_TEST_IP:-1.1.1.1}
# GitHub renders at :00 and :30 (often a few minutes late) — fetch a little after.
export REFRESH_SCHEDULE=${REFRESH_SCHEDULE:-"8,38 6-23 * * *"}
export TIMEZONE=${TIMEZONE:-"Asia/Ho_Chi_Minh"}
export FULL_DISPLAY_REFRESH_RATE=${FULL_DISPLAY_REFRESH_RATE:-4}
export SLEEP_SCREEN_INTERVAL=3600
export LOW_BATTERY_REPORTING=${LOW_BATTERY_REPORTING:-false}
export LOW_BATTERY_THRESHOLD_PERCENT=10
EOF
chmod +x kindle/dashboard/*.sh kindle/dashboard/local/*.sh

# --- KUAL menu entry ----------------------------------------------------------
mkdir -p kindle/extensions/kindle-dash
cat > kindle/extensions/kindle-dash/config.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<extension>
  <information><name>Kindle Dashboard</name><version>1.0</version><author>pascalw</author><id>kindle-dash</id></information>
  <menus><menu type="json" dynamic="false">menu.json</menu></menus>
</extension>
EOF
cat > kindle/extensions/kindle-dash/menu.json <<'EOF'
{"items": [{"name": "Kindle Dashboard", "priority": 0, "action": "/mnt/us/dashboard/start.sh"}]}
EOF

echo "Đã tạo kindle/dashboard và kindle/extensions/kindle-dash"
