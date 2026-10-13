#!/usr/bin/env python3
"""Extrai pacotes Debian em ~/.zenyx sem apt install ou privilégios.

Executar no servidor Python depois da auditoria. Não modifica /usr ou outros
diretórios do contêiner. Os pacotes vêm das fontes APT configuradas na imagem.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

PACKAGES = (
    "tigervnc-standalone-server",
    "tigervnc-common",
    "tigervnc-tools",
    "libunwind8",
    "libxfont2",
    "libfontenc1",
    "jwm",
    "xterm",
    "libxft2",
    "libxaw7",
    "libxmu6",
    "libxinerama1",
    "libxt6",
    "libice6",
    "libutempter0",
    "x11-xkb-utils",
    "libxkbfile1",
    "libpangoxft-1.0-0",
    "libsm6",
    "novnc",
    "libegl-mesa0",
    "libegl1",
    "libgles2",
    "mesa-utils-bin",
    "mesa-utils",
)


def run(args, cwd=None, timeout=90, env=None):
    try:
        p = subprocess.run(args, cwd=cwd, env=env, capture_output=True,
                           text=True, timeout=timeout, check=False)
        return {"exit": p.returncode,
                "error": p.stderr.strip().splitlines()[-1:] if p.returncode else []}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"exit": None, "error": [type(exc).__name__]}


def main():
    root = Path.home() / ".zenyx"
    cache = root / "cache"
    overlay = root / "root"
    cache.mkdir(parents=True, exist_ok=True)
    overlay.mkdir(parents=True, exist_ok=True)
    packages = list(PACKAGES)
    report = {"bootstrap_schema": 1, "packages": {}, "binaries": {}}
    if "--flatpak" in sys.argv:
        plan = subprocess.run(["apt-get", "-s", "--no-install-recommends",
                               "install", "flatpak", "bubblewrap"],
                              capture_output=True, text=True, timeout=25)
        report["flatpak_plan"] = {"exit": plan.returncode,
                                  "packages": [line.split()[1] for line in plan.stdout.splitlines()
                                               if line.startswith("Inst ")]}
        if plan.returncode:
            print(json.dumps({"bootstrap_schema": 1, "flatpak_plan_error": True}), flush=True)
            return
        packages.extend(report["flatpak_plan"]["packages"])
    for package in dict.fromkeys(packages):
        debs = sorted(cache.glob(package + "_*.deb"))
        result = {"exit": 0, "error": [], "cached": bool(debs)}
        if not debs:
            result = run(["apt-get", "download", package], cwd=cache)
            debs = sorted(cache.glob(package + "_*.deb"))
        if result["exit"] == 0 and debs:
            result["extract"] = run(["dpkg-deb", "-x", str(debs[-1]), str(overlay)])
            result["download_bytes"] = debs[-1].stat().st_size
        report["packages"][package] = result
        if result["exit"] != 0 or result.get("extract", {}).get("exit") != 0:
            break
    python_modules = root / "python"
    python_modules.mkdir(exist_ok=True)
    report["websockify"] = run(["python3", "-m", "pip", "install", "--disable-pip-version-check",
                                  "--no-cache-dir", "--no-deps", "--target",
                                  str(python_modules), "websockify==0.13.0"], timeout=100,
                                 env=dict(os.environ, TMPDIR=str(cache)))
    library_paths = [
        overlay / "usr/lib/x86_64-linux-gnu",
        overlay / "lib/x86_64-linux-gnu",
        overlay / "usr/lib",
    ]
    env = dict(os.environ, LD_LIBRARY_PATH=":".join(map(str, library_paths)))
    for binary in ("Xtigervnc", "jwm", "xterm", "tigervncpasswd", "xkbcomp",
                   "eglinfo", "glxinfo", "flatpak", "bwrap"):
        candidates = list((overlay / "usr/bin").glob(binary))
        if not candidates:
            report["binaries"][binary] = {"present": False}
            continue
        process = subprocess.run(["ldd", str(candidates[0])], env=env,
                                 capture_output=True, text=True, timeout=8)
        report["binaries"][binary] = {
            "present": True,
            "missing_libraries": [line.strip().split()[0]
                                  for line in process.stdout.splitlines()
                                  if "not found" in line],
        }
    report_file = root / "bootstrap-report.json"
    report_file.write_text(json.dumps(report, ensure_ascii=False))
    report_file.chmod(0o600)
    summary = {"bootstrap_schema": 1, "package_count": len(report["packages"]),
               "failed_packages": [name for name, result in report["packages"].items()
                                   if result["exit"] != 0 or result.get("extract", {}).get("exit") != 0],
               "websockify_exit": report["websockify"]["exit"],
               "binaries": report["binaries"]}
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
