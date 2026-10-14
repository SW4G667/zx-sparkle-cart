#!/bin/sh
set -eu
zenyx_root="$HOME/.zenyx/root"
export PATH="$zenyx_root/usr/bin:$PATH"
export LD_LIBRARY_PATH="$zenyx_root/usr/lib/x86_64-linux-gnu:$zenyx_root/lib/x86_64-linux-gnu:$zenyx_root/usr/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec "$zenyx_root/usr/bin/pcmanfm" "$HOME"
