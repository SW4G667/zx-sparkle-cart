#!/usr/bin/env python3
"""Diagnostico somente-leitura para servidor Python Pterodactyl. Nao imprime segredos."""
import json
import os
import platform
import shutil
import sys
from pathlib import Path

def read(path):
    try:
        return Path(path).read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError):
        return None

def which_all():
    names = ("Xvfb", "openbox", "tint2", "x11vnc", "websockify", "flatpak",
             "glxinfo", "vulkaninfo", "docker", "bash", "python3", "node")
    return {name: bool(shutil.which(name)) for name in names}

def memory_limit():
    for name in ("/sys/fs/cgroup/memory.max",
                 "/sys/fs/cgroup/memory/memory.limit_in_bytes"):
        value = read(name)
        if value and value != "max" and value.isdigit():
            n = int(value)
            if n < (1 << 60):
                return round(n / (1024 ** 3), 2)
    return None

def main():
    disk = shutil.disk_usage(".")
    graphics = Path("/dev/dri")
    data = {
        "python": platform.python_version(),
        "os": platform.system(),
        "architecture": platform.machine(),
        "cpu_detected": os.cpu_count(),
        "cpu_quota_cgroup_v2": read("/sys/fs/cgroup/cpu.max"),
        "memory_limit_cgroup_gb": memory_limit(),
        "disk_free_gb": round(disk.free / (1024 ** 3), 2),
        "graphics_device_present": graphics.is_dir(),
        "graphics_devices": sorted(p.name for p in graphics.iterdir()) if graphics.is_dir() else [],
        "executables": which_all(),
        "startup_note": "Desktop so sera possivel com binarios, porta de rede e recursos graficos compativeis.",
    }
    print(json.dumps(data, indent=2, ensure_ascii=False))
    print("\nDiagnostico terminado. Nenhuma instalacao foi realizada.")

if __name__ == "__main__":
    main()
