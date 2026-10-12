#!/usr/bin/env bash
# Take the store screenshots in store/ with the theme loaded in a real
# Chromium window, so they show exactly what the browser draws.
#
# Needs Linux with Xvfb, ImageMagick (import) and NSS tools (certutil), and a
# Chromium build: branded Google Chrome ignores --load-extension.
#
#   CHROME=/path/to/chromium scripts/screenshots.sh
#
# Optional:
#   SITE        page to show (default: the Verdant Ledger website)
#   HOST_RULES  Chromium --host-resolver-rules, to serve SITE from a local copy
#   CA_CERT     certificate to trust, for a local HTTPS copy of SITE
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
chrome=${CHROME:?Set CHROME to a Chromium executable}
site=${SITE:-https://nelvaron.github.io/vscode-verdant-ledger/}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

export HOME=$work/home
export GOOGLE_API_KEY=no GOOGLE_DEFAULT_CLIENT_ID=no GOOGLE_DEFAULT_CLIENT_SECRET=no
mkdir -p "$HOME/.pki/nssdb" "$work/profile/Default"
if [ -n "${CA_CERT:-}" ]; then
  certutil -N -d "sql:$HOME/.pki/nssdb" --empty-password
  certutil -A -d "sql:$HOME/.pki/nssdb" -n local -t "C,," -i "$CA_CERT"
fi

# Show the bookmarks bar with a few bookmarks. None is a page that the
# screenshots open, so the star in the address bar stays empty.
cat > "$work/profile/Default/Preferences" <<JSON
{"bookmark_bar": {"show_on_all_tabs": true}, "browser": {"has_seen_welcome_page": true}}
JSON
cat > "$work/profile/Default/Bookmarks" <<JSON
{"version": 1, "roots": {
  "bookmark_bar": {"type": "folder", "name": "Bookmarks bar", "children": [
    {"type": "url", "name": "VS Code theme", "url": "https://marketplace.visualstudio.com/items?itemName=nelvaron.verdant-ledger-light"},
    {"type": "url", "name": "Open VSX", "url": "https://open-vsx.org/extension/nelvaron/verdant-ledger-light"},
    {"type": "folder", "name": "Design", "children": [
      {"type": "url", "name": "WCAG 2.2", "url": "https://www.w3.org/TR/WCAG22/"}]},
    {"type": "url", "name": "Changelog", "url": "https://github.com/nelvaron/chromium-verdant-ledger/blob/main/CHANGELOG.md"},
    {"type": "url", "name": "Issues", "url": "https://github.com/nelvaron/chromium-verdant-ledger/issues"}]},
  "other": {"type": "folder", "name": "Other bookmarks", "children": []},
  "synced": {"type": "folder", "name": "Mobile bookmarks", "children": []}}}
JSON

# shot <output> <width> <height> <scale> <url>...
shot() {
  local out=$1 width=$2 height=$3 scale=$4
  shift 4
  Xvfb :97 -screen 0 "$((width * scale))x$((height * scale))x24" >/dev/null 2>&1 &
  local xvfb=$!
  sleep 1
  DISPLAY=:97 "$chrome" --user-data-dir="$work/profile" --load-extension="$root/theme" \
    --no-first-run --no-default-browser-check --test-type --password-store=basic \
    --ozone-platform=x11 --disable-features=Translate,MediaRouter \
    --disable-search-engine-choice-screen --hide-crash-restore-bubble \
    ${HOST_RULES:+--host-resolver-rules="$HOST_RULES"} \
    $([ "$(id -u)" = 0 ] && echo --no-sandbox) \
    --window-position=0,0 --window-size="$width,$height" --force-device-scale-factor="$scale" \
    "$@" >"$work/chrome.log" 2>&1 &
  local browser=$!
  sleep 8
  [ -n "$out" ] && DISPLAY=:97 import -window root "$out"
  kill "$browser"
  wait "$browser" 2>/dev/null || true
  kill "$xvfb"
  wait "$xvfb" 2>/dev/null || true
}

# The first start installs the theme and shows a notice; take nothing.
shot "" 1280 800 1 "$site"

shot "$root/store/screenshot-1.png" 1280 800 1 "$site" "${site}palette/"
shot "$root/store/screenshot-2.png" 1280 800 1 "${site}palette/" "$site"
shot "$root/store/screenshot-3.png" 1280 800 1
# A close-up of the tab strip and toolbar at twice the size.
shot "$root/store/screenshot-4.png" 640 400 2 "$site" "${site}palette/"

echo "Screenshots written to store/."
