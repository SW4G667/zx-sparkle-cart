#!/usr/bin/env python3
"""Diagnostica a infraestrutura GPG exigida pelo Flatpak de usuário."""
import json
import os
import subprocess
from pathlib import Path

state = Path.home() / ".zenyx"
overlay = state / "root"
gnupg = state / "gnupg"
gnupg.mkdir(mode=0o700, exist_ok=True)
env = dict(os.environ,
           PATH=str(overlay / "usr/bin") + ":" + os.environ.get("PATH", ""),
           LD_LIBRARY_PATH=":".join(str(overlay / p) for p in (
               "usr/lib/x86_64-linux-gnu", "lib/x86_64-linux-gnu", "usr/lib")),
           GNUPGHOME=str(gnupg))
report = {"gpg_probe_schema": 1, "binaries": {}, "commands": {}}
for name in ("gpg", "gpg-agent", "gpgconf", "gpg-connect-agent", "dirmngr"):
    path = overlay / "usr/bin" / name
    report["binaries"][name] = path.is_file()
    if path.is_file():
        result = subprocess.run(["ldd", str(path)], env=env, capture_output=True,
                                text=True, timeout=10)
        report["binaries"][name + "_missing"] = [line.strip().split()[0]
            for line in result.stdout.splitlines() if "not found" in line]
for name, args in (("gpgconf_dirs", ["gpgconf", "--list-dirs"]),
                   ("gpg_agent_version", ["gpg-agent", "--version"]),
                   ("gpg_connect", ["gpg-connect-agent", "/bye"])):
    try:
        result = subprocess.run(args, env=env, capture_output=True, text=True,
                                timeout=12, check=False)
        report["commands"][name] = {"exit": result.returncode,
                                    "stdout": result.stdout.strip().splitlines()[:8],
                                    "stderr": result.stderr.strip().splitlines()[-8:]}
    except (OSError, subprocess.TimeoutExpired) as exc:
        report["commands"][name] = {"error": type(exc).__name__}
print(json.dumps(report, ensure_ascii=False), flush=True)
