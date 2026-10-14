#!/usr/bin/env python3
"""Ativa o tema Linux e publica o visor no noVNC extraído em ~/.zenyx."""
import json
import os
import shutil
from pathlib import Path

SOURCE = Path(__file__).resolve().parent
HOME = Path.home()
NOVNC = HOME / ".zenyx/root/usr/share/novnc"
ASSETS = HOME / "assets/win11"


def copy_file(source: Path, target: Path):
    if not source.is_file() or target.is_symlink():
        raise RuntimeError(f"caminho inválido: {target.name}")
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_name(target.name + ".zenyx-new")
    shutil.copyfile(source, temp)
    temp.chmod(0o644)
    os.replace(temp, target)


def main():
    if not (NOVNC / "core/rfb.js").is_file():
        raise RuntimeError("noVNC ainda não foi extraído em ~/.zenyx/root")
    current = HOME / "jwmrc"
    backup = HOME / "jwmrc-before-win11"
    if current.is_file() and not backup.exists():
        shutil.copyfile(current, backup)
        backup.chmod(0o600)
    for name in ("wallpaper.png", "start.png", "browser.png", "files.png", "terminal.png"):
        copy_file(SOURCE / "assets/win11" / name, ASSETS / name)
    copy_file(SOURCE / "jwmrc-win11", current)
    copy_file(SOURCE / "mobile.html", NOVNC / "mobile.html")
    copy_file(SOURCE / "assets/win11/start.png", NOVNC / "zenyx/start.png")
    print(json.dumps({"theme": "win11-inspired", "installed": True,
                      "restart_required": True, "viewer": "mobile.html",
                      "previous_theme_saved": backup.is_file()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
