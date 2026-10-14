#!/usr/bin/env python3
"""Verifica isolamento adicional e extrai a tradução pt-BR sem root."""
import json
import os
import subprocess
from pathlib import Path

ROOT = Path.home() / ".zenyx"
OVERLAY = ROOT / "root"
CACHE = ROOT / "cache"
ENV = dict(os.environ, LD_LIBRARY_PATH=":".join(str(OVERLAY / part) for part in (
    "usr/lib/x86_64-linux-gnu", "lib/x86_64-linux-gnu", "usr/lib")))


def run(args, **kwargs):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=60,
                           check=False, **kwargs)
        return {"exit": p.returncode, "error": p.stderr.strip().splitlines()[-2:]}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"exit": None, "error": [type(exc).__name__]}


def main():
    os.umask(0o077)
    report = {"isolation_probe_schema": 1}
    report["user_namespace"] = run(["unshare", "-Ur", "true"])
    report["mount_namespace"] = run(["unshare", "-Urm", "true"])
    report["bubblewrap"] = run([str(OVERLAY / "usr/bin/bwrap"),
                                "--ro-bind", "/", "/", "--proc", "/proc",
                                "--dev-bind", "/dev", "/dev", "--", "/bin/true"],
                               env=ENV)
    package = "firefox-esr-l10n-pt-br"
    debs = sorted(CACHE.glob(package + "_*.deb"))
    report["locale_download"] = {"exit": 0, "cached": bool(debs)} if debs else run(
        ["apt-get", "download", package], cwd=CACHE)
    debs = sorted(CACHE.glob(package + "_*.deb"))
    if report["locale_download"]["exit"] == 0 and debs:
        report["locale_extract"] = run(["dpkg-deb", "-x", str(debs[-1]), str(OVERLAY)])
        report["locale_bytes"] = debs[-1].stat().st_size
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
