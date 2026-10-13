#!/usr/bin/env python3
"""Consulta o Sober no Flathub sem baixar aplicativo ou runtime."""
import json
import os
import subprocess
import time
from pathlib import Path

state = Path.home() / ".zenyx"
overlay = state / "root"
runtime = state / "runtime"
runtime.mkdir(mode=0o700, exist_ok=True)
gnupg = state / "gnupg"
gnupg.mkdir(mode=0o700, exist_ok=True)
env = dict(os.environ,
           PATH=str(overlay / "usr/bin") + ":" + os.environ.get("PATH", ""),
           LD_LIBRARY_PATH=":".join(str(overlay / p) for p in (
               "usr/lib/x86_64-linux-gnu", "lib/x86_64-linux-gnu", "usr/lib")),
           XDG_DATA_HOME=str(state / "share"),
           XDG_CACHE_HOME=str(state / "cache"),
           XDG_RUNTIME_DIR=str(runtime), GNUPGHOME=str(gnupg))
commands = (
    ("remote_add", ["flatpak", "--user", "remote-add", "--if-not-exists",
                    "flathub", "https://flathub.org/repo/flathub.flatpakrepo"]),
    ("remote_info", ["flatpak", "--user", "remote-info", "flathub",
                     "org.vinegarhq.Sober"]),
)
log = (state / "gpg-agent.log").open("ab", buffering=0)
agent = subprocess.Popen(["gpg-agent", "--daemon", "--no-detach",
                          "--homedir", str(gnupg)], env=env,
                         stdin=subprocess.DEVNULL, stdout=log,
                         stderr=subprocess.STDOUT, start_new_session=True)
log.close()
ready = False
for _ in range(20):
    check = subprocess.run(["gpg-connect-agent", "/bye"], env=env,
                           capture_output=True, timeout=3, check=False)
    if check.returncode == 0:
        ready = True
        break
    if agent.poll() is not None:
        break
    time.sleep(0.25)
print(json.dumps({"sober_plan_schema": 1, "stage": "gpg_agent",
                  "exit": 0 if ready else 1,
                  "agent_running": agent.poll() is None}, ensure_ascii=False), flush=True)
if not ready:
    raise SystemExit(1)
for name, args in commands:
    try:
        result = subprocess.run(args, env=env, text=True, timeout=90,
                                check=False, capture_output=True)
        output = [line.strip() for line in (result.stdout or "").splitlines()
                  if any(word in line.lower() for word in (
                      "id:", "ref:", "arch:", "branch:", "runtime:", "download:",
                      "installed:", "commit:", "license:"))]
        report = {"sober_plan_schema": 1, "stage": name,
                  "exit": result.returncode, "output": output[:15],
                  "error": (result.stderr or "").strip().splitlines()[-3:]}
    except (OSError, subprocess.TimeoutExpired) as exc:
        report = {"sober_plan_schema": 1, "stage": name,
                  "error": [type(exc).__name__]}
    print(json.dumps(report, ensure_ascii=False), flush=True)
    if report.get("exit") != 0:
        break
