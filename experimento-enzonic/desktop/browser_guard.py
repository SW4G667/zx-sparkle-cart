#!/usr/bin/env python3
"""Restringe o Firefox com Landlock antes de iniciar o processo gráfico.

O sandbox nativo do Firefox falha com chroot EPERM neste Pterodactyl. Landlock
nega acesso aos arquivos da sessão, especialmente à senha VNC, mesmo quando o
processo de conteúdo do Firefox precisa operar sem seu sandbox nativo.
"""
import ctypes
import errno
import json
import os
import sys
from pathlib import Path

HOME = Path("/home/container")
BROWSER_HOME = HOME / ".zenyx/firefox-home"
OVERLAY = HOME / ".zenyx/root"
READ = (1 << 0) | (1 << 2) | (1 << 3)  # executar, ler arquivo, listar pasta
ALL_FS = (1 << 16) - 1  # Landlock ABI >= 5, incluindo IOCTL_DEV
PR_SET_NO_NEW_PRIVS = 38
LANDLOCK_RULE_PATH_BENEATH = 1


class RulesetAttr(ctypes.Structure):
    _fields_ = [("handled_access_fs", ctypes.c_uint64)]


class PathBeneathAttr(ctypes.Structure):
    _fields_ = [("allowed_access", ctypes.c_uint64),
                ("parent_fd", ctypes.c_int)]


def checked(value, operation):
    if value < 0:
        code = ctypes.get_errno()
        raise OSError(code, f"{operation}: {os.strerror(code)}")
    return value


def main():
    libc = ctypes.CDLL(None, use_errno=True)
    version = checked(libc.syscall(444, 0, 0, 1), "Landlock ABI")
    if version < 5:
        raise RuntimeError("Landlock ABI 5 or newer required")
    attr = RulesetAttr(ALL_FS)
    ruleset_fd = checked(libc.syscall(444, ctypes.byref(attr), ctypes.sizeof(attr), 0),
                         "create ruleset")
    try:
        for path in ("/usr", "/bin", "/sbin", "/lib", "/lib64", "/etc",
                     "/proc", "/sys", "/run", "/var", str(OVERLAY)):
            if not Path(path).exists():
                continue
            parent_fd = os.open(path, os.O_PATH | os.O_CLOEXEC)
            try:
                rule = PathBeneathAttr(READ, parent_fd)
                checked(libc.syscall(445, ruleset_fd, LANDLOCK_RULE_PATH_BENEATH,
                                     ctypes.byref(rule), 0), "allow read " + path)
            finally:
                os.close(parent_fd)
        for path in ("/tmp", "/dev", str(BROWSER_HOME)):
            parent_fd = os.open(path, os.O_PATH | os.O_CLOEXEC)
            try:
                rule = PathBeneathAttr(ALL_FS, parent_fd)
                checked(libc.syscall(445, ruleset_fd, LANDLOCK_RULE_PATH_BENEATH,
                                     ctypes.byref(rule), 0), "allow browser " + path)
            finally:
                os.close(parent_fd)
        checked(libc.prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0), "no_new_privs")
        checked(libc.syscall(446, ruleset_fd, 0), "restrict self")
    finally:
        os.close(ruleset_fd)
    blocked = {}
    for name in ("vnc.passwd", "vnc-login.txt"):
        secret = HOME / ".zenyx/private" / name
        try:
            secret.read_bytes()
        except OSError as exc:
            blocked[name] = exc.errno in (errno.EACCES, errno.EPERM)
        else:
            blocked[name] = False
    try:
        (BROWSER_HOME / "welcome.html").read_bytes()
        welcome_accessible = True
    except OSError:
        welcome_accessible = False
    report = {"landlock_abi": version,
              "vnc_secret_blocked": blocked["vnc.passwd"],
              "vnc_login_blocked": blocked["vnc-login.txt"],
              "welcome_accessible": welcome_accessible}
    (BROWSER_HOME / "guard-report.json").write_text(json.dumps(report))
    if not all(blocked.values()) or not welcome_accessible:
        raise RuntimeError("Firefox guard verification failed")
    os.execv(sys.argv[1], sys.argv[1:])


if __name__ == "__main__":
    main()
