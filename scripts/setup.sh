#!/usr/bin/env bash
# One-shot setup: GitHub repo + secrets + Pages + first render + Kindle config files.
# Secrets are typed into gh's own hidden prompt; they never touch disk or this script's output.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_NAME="${1:-kindle-dashboard}"

say() { printf "\n\033[1m▸ %s\033[0m\n" "$*"; }

say "1/6 Kiểm tra công cụ"
if ! command -v gh >/dev/null; then
  command -v brew >/dev/null || { echo "Cần Homebrew: https://brew.sh"; exit 1; }
  brew install gh
fi
gh auth status >/dev/null 2>&1 || gh auth login --web --git-protocol https --scopes "repo,workflow"
OWNER="$(gh api user -q .login)"
REPO="$OWNER/$REPO_NAME"

say "2/6 Tạo repo $REPO (public, để Actions + Pages miễn phí; dữ liệu chỉ nằm trong Secrets)"
[ -d .git ] || git init -q -b main
git add -A
git diff --cached --quiet || git commit -qm "Kindle Notion dashboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
if gh repo view "$REPO" >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$REPO.git"
  git push -u origin main
else
  gh repo create "$REPO" --public --source . --push
fi

say "3/6 Secrets — dán giá trị vào ô hỏi của gh (không hiện ra màn hình)"
echo "• Notion token (bắt đầu bằng ntn_ hoặc secret_):"
gh secret set NOTION_TOKEN -R "$REPO"
echo "• Link iCal bí mật của từng lịch Google (dán một link rồi Enter; Enter trống để kết thúc):"
ICS=""
while true; do
  read -r -s -p "  link: " one; echo
  [ -z "$one" ] && break
  case "$one" in https://calendar.google.com/*ics*) ;; *) echo "  (không giống link iCal, bỏ qua)"; continue ;; esac
  ICS="${ICS:+$ICS,}$one"; echo "  đã nhận"
done
if [ -n "$ICS" ]; then printf '%s' "$ICS" | gh secret set GCAL_ICS_URLS -R "$REPO"; fi
unset ICS one
read -r -p "• Có Anthropic API key cho phần gợi ý thông minh? [y/N] " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then gh secret set ANTHROPIC_API_KEY -R "$REPO"; fi
if [ ! -f .kindle-url ]; then
  SLUG="$(openssl rand -hex 16)"
  gh secret set DASHBOARD_SLUG -R "$REPO" --body "$SLUG"
  echo "https://$OWNER.github.io/$REPO_NAME/$SLUG.png" > .kindle-url
fi
URL="$(cat .kindle-url)"

say "4/6 Bật GitHub Pages (nguồn: GitHub Actions)"
gh api -X POST "repos/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 \
  || gh api -X PUT "repos/$REPO/pages" -f build_type=workflow >/dev/null

say "5/6 Render lần đầu"
gh workflow run render.yml -R "$REPO"
sleep 8
RUN_ID="$(gh run list -R "$REPO" -w render.yml -L 1 --json databaseId -q '.[0].databaseId')"
gh run watch "$RUN_ID" -R "$REPO" --exit-status

say "6/6 Tạo file cho Kindle (kindle-dash)"
mkdir -p kindle/local
cat > kindle/local/fetch-dashboard <<EOF
#!/usr/bin/env sh
# Called by kindle-dash with the output path as \$1
curl -fsS --max-time 60 "$URL" -o "\$1"
EOF
chmod +x kindle/local/fetch-dashboard
cat > kindle/local/env.sh <<'EOF'
export WIFI_TEST_IP=${WIFI_TEST_IP:-1.1.1.1}
export REFRESH_SCHEDULE=${REFRESH_SCHEDULE:-"*/30 6-23 * * *"}
export TIMEZONE=${TIMEZONE:-"Asia/Ho_Chi_Minh"}
export FULL_DISPLAY_REFRESH_RATE=${FULL_DISPLAY_REFRESH_RATE:-4}
export SLEEP_SCREEN_INTERVAL=${SLEEP_SCREEN_INTERVAL:-3600}
export LOW_BATTERY_REPORTING=${LOW_BATTERY_REPORTING:-false}
export LOW_BATTERY_THRESHOLD_PERCENT=10
EOF

echo
echo "Xong. Ảnh dashboard: $URL"
echo "Mở thử link trên trình duyệt. Sau khi jailbreak Kindle, chép thư mục kindle/local"
echo "đè vào kindle-dash/local trên Kindle (xem docs/SETUP.md mục 5)."
