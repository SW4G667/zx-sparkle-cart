#!/usr/bin/env bash
set -euo pipefail
umask 077

: "$"{VNC_PASSWORD:?Defina VNC_PASSWORD no painel de variaveis do provedor}
PORT="$"{PORT:-8080}
SCREEN_WIDTH="$"{SCREEN_WIDTH:-854}
SCREEN_HEIGHT="$"{SCREEN_HEIGHT:-480}
DISPLAY=:5
export DISPLAY

case "$PORT" in *[!0-9]*|"") echo "PORT invalida" >&2; exit 2;; esac
case "$SCREEN_WIDTH:$SCREEN_HEIGHT" in *[!0-9:]*|"") echo "Resolucao invalida" >&2; exit 2;; esac

mkdir -p "$HOME/.vnc"
x11vnc -storepasswd "$VNC_PASSWORD" "$HOME/.vnc/passwd" >/dev/null 2>&1
unset VNC_PASSWORD

Xvfb "$DISPLAY" -screen 0 "$"{SCREEN_WIDTH}x$"{SCREEN_HEIGHT}x16 -nolisten tcp -noreset &
XVFB_PID=$!
cleanup() {
  kill "$"{OPENBOX_PID:-} "$"{TINT2_PID:-} "$"{VNC_PID:-} "$XVFB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
sleep 2
kill -0 "$XVFB_PID"

xsetroot -solid '#151b2a' || true
openbox >/tmp/openbox.log 2>&1 &
OPENBOX_PID=$!
tint2 >/tmp/tint2.log 2>&1 &
TINT2_PID=$!
x11vnc -display "$DISPLAY" -forever -shared -localhost -rfbport 5900 \
  -rfbauth "$HOME/.vnc/passwd" -noxdamage -quiet >/tmp/x11vnc.log 2>&1 &
VNC_PID=$!

echo "Desktop iniciado. Porta web: $PORT. Use senha VNC configurada."
echo "ATENCAO: isto nao testa nem inicia Roblox."
websockify --web=/usr/share/novnc "0.0.0.0:$PORT" 127.0.0.1:5900 &
WEB_PID=$!
wait "$WEB_PID"
