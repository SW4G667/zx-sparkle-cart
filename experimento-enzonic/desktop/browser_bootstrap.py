#!/usr/bin/env python3
"""Extrai Firefox ESR e PCManFM no diretório do usuário, sem privilégios."""
import json
import os
import subprocess
from pathlib import Path

ROOT = Path.home() / ".zenyx"
CACHE = ROOT / "cache"
OVERLAY = ROOT / "root"
REPORT = ROOT / "browser-report.json"
# Dependências de serviços de init entram no plano APT, mas não são executadas
# para abrir programas gráficos dentro do contêiner Pterodactyl.
SERVICE_PACKAGES = {
    "libargon2-1", "dmsetup", "libdevmapper1.02.1", "libcryptsetup12",
    "libfdisk1", "libkmod2", "libip4tc2", "libsystemd-shared", "systemd",
    "systemd-sysv", "libpam-systemd", "dbus-user-session",
}


def command(args, *, cwd=None, timeout=180, env=None):
    try:
        result = subprocess.run(args, cwd=cwd, env=env, text=True,
                                capture_output=True, timeout=timeout, check=False)
        return {"exit": result.returncode,
                "error": result.stderr.strip().splitlines()[-2:] if result.returncode else []}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"exit": None, "error": [type(exc).__name__]}


def save(report):
    REPORT.write_text(json.dumps(report, ensure_ascii=False))
    REPORT.chmod(0o600)


def main():
    os.umask(0o077)
    CACHE.mkdir(parents=True, exist_ok=True)
    OVERLAY.mkdir(parents=True, exist_ok=True)
    plan = subprocess.run(["apt-get", "-s", "--no-install-recommends",
                           "install", "firefox-esr", "firefox-esr-l10n-pt-br",
                           "pcmanfm", "fonts-dejavu-core"],
                          capture_output=True, text=True, timeout=30, check=False)
    packages = [line.split()[1] for line in plan.stdout.splitlines()
                if line.startswith("Inst ") and line.split()[1] not in SERVICE_PACKAGES]
    report = {"browser_install_schema": 1, "plan_exit": plan.returncode,
              "packages": {}, "skipped_service_packages": sorted(SERVICE_PACKAGES),
              "binaries": {}}
    if plan.returncode:
        report["plan_error"] = plan.stderr.strip().splitlines()[-2:]
        save(report)
        print(json.dumps(report, ensure_ascii=False), flush=True)
        return
    for package in dict.fromkeys(packages):
        debs = sorted(CACHE.glob(package + "_*.deb"))
        result = {"exit": 0, "cached": bool(debs)}
        if not debs:
            result = command(["apt-get", "download", package], cwd=CACHE,
                             timeout=300 if package == "firefox-esr" else 120)
            debs = sorted(CACHE.glob(package + "_*.deb"))
        if result["exit"] == 0 and debs:
            result["extract"] = command(["dpkg-deb", "-x", str(debs[-1]), str(OVERLAY)],
                                        timeout=150)
            result["download_bytes"] = debs[-1].stat().st_size
        report["packages"][package] = result
        save(report)
        if result["exit"] != 0 or result.get("extract", {}).get("exit") != 0:
            break
    env = dict(os.environ, LD_LIBRARY_PATH=":".join(str(OVERLAY / path) for path in (
        "usr/lib/x86_64-linux-gnu", "lib/x86_64-linux-gnu", "usr/lib")))
    for name, path in {"firefox": OVERLAY / "usr/lib/firefox-esr/firefox-esr",
                       "libxul": OVERLAY / "usr/lib/firefox-esr/libxul.so",
                       "pcmanfm": OVERLAY / "usr/bin/pcmanfm"}.items():
        if path.is_file():
            checked = subprocess.run(["ldd", str(path)], capture_output=True,
                                     text=True, env=env, timeout=20, check=False)
            report["binaries"][name] = {
                "present": True, "missing": [line.strip().split()[0]
                                             for line in checked.stdout.splitlines()
                                             if "not found" in line]}
        else:
            report["binaries"][name] = {"present": False}
    save(report)
    summary = {"browser_install_schema": 1, "plan_exit": report["plan_exit"],
               "package_count": len(report["packages"]),
               "failed": [name for name, result in report["packages"].items()
                          if result["exit"] != 0 or result.get("extract", {}).get("exit") != 0],
               "download_bytes": sum(result.get("download_bytes", 0)
                                     for result in report["packages"].values()),
               "binaries": report["binaries"]}
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
