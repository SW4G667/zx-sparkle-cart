#!/usr/bin/env python3
"""Auditoria somente de leitura para o contêiner Python Pterodactyl.

Não enumera variáveis de ambiente, credenciais ou arquivos do usuário.
"""
import ctypes.util
import json
import os
import platform
import shutil
import subprocess
from pathlib import Path

TOOLS = (
    "Xvfb", "Xorg", "openbox", "tint2", "xterm", "x11vnc", "Xtigervnc",
    "vncserver", "websockify", "novnc_proxy", "flatpak", "glxinfo",
    "eglinfo", "vulkaninfo", "ffmpeg", "docker", "apt-get", "apk",
    "bash", "python3", "node", "npm",
)


def read(path):
    try:
        return Path(path).read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError):
        return None


def limit(path):
    value = read(path)
    if value and value.isdigit() and int(value) < (1 << 60):
        return int(value)
    return None


def version(binary):
    if not shutil.which(binary):
        return None
    try:
        result = subprocess.run([binary, "--version"], capture_output=True,
                                text=True, timeout=3, check=False)
        return (result.stdout or result.stderr).splitlines()[0][:120]
    except (OSError, subprocess.TimeoutExpired, IndexError):
        return None


def cpu_quota():
    value = read("/sys/fs/cgroup/cpu.max")
    if value:
        quota, _, period = value.partition(" ")
        if quota.isdigit() and period.isdigit() and int(period):
            return round(int(quota) / int(period), 2)
    quota = limit("/sys/fs/cgroup/cpu/cpu.cfs_quota_us")
    period = limit("/sys/fs/cgroup/cpu/cpu.cfs_period_us")
    return round(quota / period, 2) if quota is not None and period else None


def status_field(name):
    for line in (read("/proc/self/status") or "").splitlines():
        if line.startswith(name + ":"):
            return line.partition(":")[2].strip()
    return None


def main():
    disk = shutil.disk_usage(".")
    graphics = Path("/dev/dri")
    release = {}
    for line in (read("/etc/os-release") or "").splitlines():
        key, sep, value = line.partition("=")
        if sep and key in ("ID", "VERSION_ID", "PRETTY_NAME"):
            release[key.lower()] = value.strip('"')
    memory = limit("/sys/fs/cgroup/memory.max")
    if memory is None:
        memory = limit("/sys/fs/cgroup/memory/memory.limit_in_bytes")
    ports = {name: int(os.environ[name]) for name in ("SERVER_PORT", "PORT")
             if os.environ.get(name, "").isdigit()}
    data = {
        "diagnostic_schema": 2,
        "runtime": {
            "python": platform.python_version(), "node": version("node"),
            "kernel": platform.release(), "architecture": platform.machine(),
            "distribution": release,
        },
        "cpu": {
            "visible_logical_processors": os.cpu_count(),
            "affinity_processors": len(os.sched_getaffinity(0)) if hasattr(os, "sched_getaffinity") else None,
            "quota_cores": cpu_quota(),
            "cpuset_effective": read("/sys/fs/cgroup/cpuset.cpus.effective"),
        },
        "memory": {
            "limit_bytes": memory,
            "current_bytes": limit("/sys/fs/cgroup/memory.current"),
            "swap_limit_bytes": limit("/sys/fs/cgroup/memory.swap.max"),
        },
        "storage": {
            "filesystem_total_bytes": disk.total,
            "filesystem_free_bytes": disk.free,
            "cwd_writable": os.access(".", os.W_OK),
            "note": "O tamanho do sistema de arquivos pode diferir da cota do painel.",
        },
        "container": {
            "uid": os.getuid(), "docker_marker": Path("/.dockerenv").exists(),
            "seccomp_mode": status_field("Seccomp"),
            "no_new_privileges": status_field("NoNewPrivs"),
        },
        "graphics": {
            "dri_devices": sorted(p.name for p in graphics.iterdir()) if graphics.is_dir() else [],
            "libraries": {name: bool(ctypes.util.find_library(name))
                          for name in ("GL", "EGL", "GLESv2", "vulkan")},
        },
        "executables": {name: bool(shutil.which(name)) for name in TOOLS},
        "network": {
            "configured_ports": ports,
            "note": "Porta configurada não comprova publicação HTTPS ou acesso externo.",
        },
    }
    print(json.dumps(data, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
