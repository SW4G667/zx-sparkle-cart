#!/bin/sh
set -eu
umask 077
: "${ZENYX_PREVIEW_PASSWORD:?Provide a test-only VNC password through the environment}"
mkdir -p "$HOME/.zenyx/private" "$HOME/.zenyx/logs"
printf '%s\n' "$ZENYX_PREVIEW_PASSWORD" | tigervncpasswd -f > "$HOME/.zenyx/private/vnc.passwd"
chmod 600 "$HOME/.zenyx/private/vnc.passwd"
Xtigervnc :5 -geometry 854x480 -depth 16 -rfbport 5905 -localhost \
  -SecurityTypes VncAuth -PasswordFile "$HOME/.zenyx/private/vnc.passwd" \
  -nolisten tcp > "$HOME/.zenyx/logs/Xtigervnc.log" 2>&1 &
xpid=$!
count=0
while [ "$count" -lt 40 ] && ! python3 -c 'import socket; s=socket.create_connection(("127.0.0.1",5905),.2); s.close()' 2>/dev/null; do
  count=$((count+1))
  sleep .25
done
if ! kill -0 "$xpid" 2>/dev/null || ! python3 -c 'import socket; s=socket.create_connection(("127.0.0.1",5905),.2); s.close()' 2>/dev/null; then
  cat "$HOME/.zenyx/logs/Xtigervnc.log" >&2
  kill "$xpid" 2>/dev/null || true
  exit 1
fi
jwm -f "$HOME/jwmrc" > "$HOME/.zenyx/logs/jwm.log" 2>&1 &
jpid=$!
websockify --web=/usr/share/novnc 0.0.0.0:7860 127.0.0.1:5905 &
wpid=$!
trap 'kill "$wpid" "$jpid" "$xpid" 2>/dev/null || true' INT TERM EXIT
wait "$wpid"
