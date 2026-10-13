#!/usr/bin/env python3
"""Verifica a instalação sem root do Flatpak, sem baixar aplicativos."""
import json
import os
import subprocess
from pathlib import Path

root = Path.home() / ".zenyx"
overlay = root / "root"
env = dict(os.environ, PATH=str(overlay / "usr/bin") + ":" + os.environ.get("PATH", ""),
           LD_LIBRARY_PATH=":".join(str(overlay / p) for p in (
               "usr/lib/x86_64-linux-gnu", "lib/x86_64-linux-gnu", "usr/lib")),
           XDG_DATA_HOME=str(root / "share"), XDG_CACHE_HOME=str(root / "cache"))
report = {"flatpak_probe_schema": 1, "binaries": {}, "commands": {}}
for name in ("flatpak", "bwrap", "xdg-dbus-proxy"):
    path = overlay / "usr/bin" / name
    report["binaries"][name] = path.is_file()
    if path.is_file():
        result = subprocess.run(["ldd", str(path)], env=env, capture_output=True,
                                text=True, timeout=10)
        report["binaries"][name + "_missing"] = [line.strip().split()[0]
            for line in result.stdout.splitlines() if "not found" in line]
for name, args in (("flatpak_version", ["flatpak", "--version"]),
                   ("bwrap_version", ["bwrap", "--version"]),
                   ("flatpak_remotes", ["flatpak", "--user", "remotes"])):
    try:
        result = subprocess.run(args, env=env, capture_output=True, text=True,
                                timeout=20, check=False)
        report["commands"][name] = {"exit": result.returncode,
                                    "stdout": result.stdout.strip().splitlines()[:2],
                                    "stderr": result.stderr.strip().splitlines()[-3:]}
    except (OSError, subprocess.TimeoutExpired) as exc:
        report["commands"][name] = {"error": type(exc).__name__}
print(json.dumps(report, ensure_ascii=False), flush=True)
