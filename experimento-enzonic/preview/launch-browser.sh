#!/bin/sh
set -eu
mkdir -p "$HOME/.zenyx/firefox-preview"
exec firefox-esr --profile "$HOME/.zenyx/firefox-preview" "file://$HOME/welcome.html"
