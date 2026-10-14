#!/usr/bin/env python3
"""Compara navegadores e um gerenciador de arquivos sem instalar pacotes."""
import json
import subprocess

choices = {
    "firefox_esr": ["firefox-esr", "fonts-dejavu-core"],
    "chromium": ["chromium", "fonts-dejavu-core"],
    "netsurf": ["netsurf-gtk", "fonts-dejavu-core"],
    "file_manager": ["pcmanfm"],
}
plans = {}
for name, packages in choices.items():
    command = ["apt-get", "-s", "--no-install-recommends", "install", *packages]
    result = subprocess.run(command, capture_output=True, text=True, timeout=30)
    names = [line.split()[1] for line in result.stdout.splitlines()
             if line.startswith("Inst ")]
    details = subprocess.run(["apt-cache", "show", packages[0]],
                             capture_output=True, text=True, timeout=5)
    size = next((int(line.partition(": ")[2]) for line in details.stdout.splitlines()
                 if line.startswith("Size: ")), None)
    plans[name] = {"exit": result.returncode, "package_count": len(names),
                   "main_package_bytes": size,
                   "packages": names if name in ("firefox_esr", "file_manager") else names[:8]}
print(json.dumps({"browser_plan_schema": 1, "plans": plans},
                 ensure_ascii=False), flush=True)
