#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${VNC_PASSWORD:?Defina VNC_PASSWORD nas variaveis privadas do provedor}"
PORT="${PORT:-8080}"
SCREEN_WIDTH="${SCREEN_WIDTH:-854}"
SCREEN_HEIGHT="${SCREEN_HEIGHT:-480}"
export DISPLAY=:5
case "$PORT" in *[!0-9]*|"") echo "PORT invalida" >&2; exit 2;; esac
case "$SCREEN_WIDTH:$SCREEN_HEIGHT" in *[!0-9:]*|"") echo "Resolucao invalida" >&2; exit 2;; esac
mkdir -p "$HOME/.vnc"
case "$VNC_PASSWORD" in *$'\n'*|"") echo "VNC_PASSWORD invalida" >&2; exit 2;; esac
printf '%s\n' "$VNC_PASSWORD" >"$HOME/.vnc/passwdfile"
unset VNC_PASSWORD
Xvfb "$DISPLAY" -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x16" -nolisten tcp -noreset &
XVFB_PID=$!
cleanup() {
  kill "${WEB_PID:-}" "${OPENBOX_PID:-}" "${TINT2_PID:-}" "${VNC_PID:-}" "$XVFB_PID" 2>/dev/null || true
  unlink "$HOME/.vnc/passwdfile" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
sleep 2
kill -0 "$XVFB_PID"
xsetroot -solid "#151b2a" || true
openbox >/tmp/openbox.log 2>&1 &
OPENBOX_PID=$!
tint2 >/tmp/tint2.log 2>&1 &
TINT2_PID=$!
x11vnc -display "$DISPLAY" -forever -shared -localhost -rfbport 5900 -passwdfile "$HOME/.vnc/passwdfile" -noxdamage -quiet >/tmp/x11vnc.log 2>&1 &
VNC_PID=$!
echo "Desktop inicializado na porta web $PORT. Roblox nao foi instalado."
websockify --web=/usr/share/novnc "0.0.0.0:$PORT" 127.0.0.1:5900 &
WEB_PID=$!
wait "$WEB_PID"
