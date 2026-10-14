#!/bin/sh
set -eu
umask 077
zenyx_root="$HOME/.zenyx/root"
export PATH="$zenyx_root/usr/bin:$PATH"
export LD_LIBRARY_PATH="$zenyx_root/usr/lib/firefox-esr:$zenyx_root/usr/lib/x86_64-linux-gnu:$zenyx_root/lib/x86_64-linux-gnu:$zenyx_root/usr/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
browser_home="$HOME/.zenyx/firefox-home"
mkdir -p "$browser_home/profile" "$browser_home/cache" "$browser_home/config" "$browser_home/runtime" "$browser_home/tmp" "$browser_home/Downloads"
chmod 700 "$browser_home" "$browser_home/profile" "$browser_home/runtime"
cp "$HOME/welcome.html" "$browser_home/welcome.html"
cat > "$browser_home/profile/user.js" <<'PREFS'
user_pref("intl.locale.requested", "pt-BR");
user_pref("browser.startup.page", 1);
user_pref("browser.startup.homepage", "file:///home/container/.zenyx/firefox-home/welcome.html");
PREFS
export HOME="$browser_home"
export XDG_CACHE_HOME="$browser_home/cache"
export XDG_CONFIG_HOME="$browser_home/config"
export XDG_RUNTIME_DIR="$browser_home/runtime"
export TMPDIR="$browser_home/tmp"
export MOZ_DISABLE_CONTENT_SANDBOX=1
rm -f "$browser_home/guard-report.json"
exec python3 /home/container/browser_guard.py "$zenyx_root/usr/lib/firefox-esr/firefox-esr" --profile "$browser_home/profile" "$@"
