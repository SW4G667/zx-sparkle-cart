#!/usr/bin/env python3
"""Inicia o desktop VNC mínimo no contêiner Python, sem acesso root."""
import json
import os
import secrets
import shutil
import signal
import socket
import stat
import subprocess
import sys
import time
import urllib.request
from ctypes.util import find_library
from pathlib import Path

HOME = Path.home()
STATE = HOME / ".zenyx"
OVERLAY = STATE / "root"
LOGS = STATE / "logs"
PRIVATE = STATE / "private"
DISPLAY = ":5"
VNC_PORT = 5905
WEB_PORT = int(os.environ.get("ZENYX_WEB_PORT", "50130"))
WEB_CHECK_INTERVAL = 10
WEB_FAILURE_THRESHOLD = 3
WEB_RESTART_WINDOW = 60
WEB_RESTART_LIMIT = 3
GEOMETRY = "854x480"
PROCESSES = []
STOP = False


def on_stop(_signum, _frame):
    global STOP
    STOP = True


def report(stage, **fields):
    print(json.dumps({"session_schema": 1, "stage": stage, **fields},
                     ensure_ascii=False), flush=True)


def start(name, args, env):
    log = (LOGS / (name + ".log")).open("ab", buffering=0)
    proc = subprocess.Popen(args, env=env, stdin=subprocess.DEVNULL,
                            stdout=log, stderr=subprocess.STDOUT,
                            start_new_session=True)
    log.close()
    PROCESSES.append((name, proc))
    return proc


def connected():
    try:
        with socket.create_connection(("127.0.0.1", VNC_PORT), timeout=2) as sock:
            return sock.recv(12).startswith(b"RFB ")
    except OSError:
        return False


def web_command():
    return [sys.executable, "-m", "websockify",
            "--web=" + str(OVERLAY / "usr/share/novnc"),
            "0.0.0.0:" + str(WEB_PORT), "127.0.0.1:5905"]


def probe_web():
    http = False
    websocket = False
    try:
        with urllib.request.urlopen("http://127.0.0.1:" + str(WEB_PORT) + "/vnc.html",
                                    timeout=1) as response:
            http = response.status == 200 and b"noVNC" in response.read(4096)
    except (OSError, TimeoutError):
        pass
    if http:
        try:
            with socket.create_connection(("127.0.0.1", WEB_PORT), timeout=2) as sock:
                sock.sendall(b"GET /websockify HTTP/1.1\r\nHost: localhost\r\n"
                             b"Upgrade: websocket\r\nConnection: Upgrade\r\n"
                             b"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
                             b"Sec-WebSocket-Version: 13\r\n"
                             b"Sec-WebSocket-Protocol: binary\r\n\r\n")
                websocket = sock.recv(512).startswith(b"HTTP/1.1 101")
        except OSError:
            pass
    return http, websocket


def wait_web_ready(web):
    http = websocket = False
    for _ in range(20):
        if web.poll() is not None:
            break
        http, websocket = probe_web()
        if http and websocket:
            break
        time.sleep(0.25)
    return http, websocket


def supervise_web_session(xserver, window_manager, web, env):
    """Mantém o acesso web ativo sem reiniciar a sessão gráfica."""
    web_failures = 0
    web_restart_times = []
    next_web_check = time.monotonic() + WEB_CHECK_INTERVAL
    while not STOP and xserver.poll() is None and window_manager.poll() is None:
        now = time.monotonic()
        reason = None
        if web.poll() is not None:
            reason = "process exited"
        elif now >= next_web_check:
            web_http, web_socket = probe_web()
            next_web_check = time.monotonic() + WEB_CHECK_INTERVAL
            if web_http and web_socket:
                web_failures = 0
            else:
                web_failures += 1
                report("web_probe", http_loopback=web_http,
                       websocket_upgrade=web_socket,
                       consecutive_failures=web_failures)
                if web_failures >= WEB_FAILURE_THRESHOLD:
                    reason = "local probe failed"
        if reason:
            web_restart_times = [t for t in web_restart_times
                                 if now - t < WEB_RESTART_WINDOW]
            if len(web_restart_times) >= WEB_RESTART_LIMIT:
                report("error", component="websockify",
                       reason="restart limit reached",
                       attempts=len(web_restart_times), window_seconds=WEB_RESTART_WINDOW)
                return 1
            if web.poll() is None:
                web.terminate()
                try:
                    web.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    web.kill()
                    web.wait(timeout=3)
            attempt = len(web_restart_times) + 1
            web_restart_times.append(now)
            report("web_restart", reason=reason, attempt=attempt, old_exit=web.poll())
            time.sleep(min(2 ** (attempt - 1), 4))
            if STOP:
                break
            web = start("websockify", web_command(), env)
            web_http, web_socket = wait_web_ready(web)
            report("web_restart_probe", attempt=attempt, http_loopback=web_http,
                   websocket_upgrade=web_socket, websockify_running=web.poll() is None)
            if web_http and web_socket and web.poll() is None:
                web_failures = 0
                next_web_check = time.monotonic() + WEB_CHECK_INTERVAL
            else:
                web_failures = WEB_FAILURE_THRESHOLD - 1
                next_web_check = 0
        time.sleep(1)
    return 0 if STOP else 1


def load_vnc_password():
    """Cria a senha inicial uma vez e lê somente o arquivo privado validado."""
    try:
        private_fd = os.open(PRIVATE, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    except OSError:
        report("error", component="VNC", reason="private directory inaccessible")
        return None
    try:
        info = os.fstat(private_fd)
        if (info.st_uid != os.getuid() or
                stat.S_IMODE(info.st_mode) != 0o700):
            report("error", component="VNC", reason="private directory permissions invalid")
            return None
        name = "vnc-login.txt"
        try:
            password_fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                                  os.O_NOFOLLOW, 0o600, dir_fd=private_fd)
        except FileExistsError:
            pass
        except OSError:
            report("error", component="VNC", reason="password file cannot be created")
            return None
        else:
            password = secrets.token_urlsafe(6)[:8]
            try:
                with os.fdopen(password_fd, "w", encoding="ascii") as output:
                    os.fchmod(output.fileno(), 0o600)
                    output.write(password + "\n")
                    output.flush()
                    os.fsync(output.fileno())
            except OSError:
                report("error", component="VNC", reason="password file cannot be written")
                return None
        try:
            password_fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW,
                                  dir_fd=private_fd)
        except OSError:
            report("error", component="VNC", reason="password file inaccessible")
            return None
        with os.fdopen(password_fd, "r", encoding="ascii") as source:
            info = os.fstat(source.fileno())
            if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or
                    stat.S_IMODE(info.st_mode) != 0o600):
                report("error", component="VNC", reason="password file permissions invalid")
                return None
            try:
                password = source.read(64).rstrip("\r\n")
                if (source.read(1) or len(password) != 8 or
                        not password.isascii() or not password.isprintable()):
                    raise ValueError("invalid password")
            except (UnicodeError, ValueError):
                report("error", component="VNC", reason="password must have 8 ASCII characters")
                return None
            return password
    finally:
        os.close(private_fd)


def main():
    os.umask(0o077)
    if not 1024 <= WEB_PORT <= 65535:
        report("error", component="websockify", reason="invalid web port")
        return 1
    for directory in (STATE, LOGS, PRIVATE):
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    env = dict(os.environ)
    env.update({
        "PATH": str(OVERLAY / "usr/bin") + ":" + env.get("PATH", "/usr/bin:/bin"),
        "LD_LIBRARY_PATH": ":".join(str(OVERLAY / path) for path in (
            "usr/lib/x86_64-linux-gnu", "lib/x86_64-linux-gnu", "usr/lib")),
        "DISPLAY": DISPLAY,
        "LANG": "C.UTF-8",
        "XDG_CONFIG_HOME": str(STATE),
    })
    # O Xserver Debian invoca /usr/bin/xkbcomp, mas /usr é somente leitura.
    # Ajusta uma cópia privada do binário para usar o compilador extraído.
    xkb_dir = Path("/tmp/zyn")
    xkb_dir.mkdir(mode=0o700, exist_ok=True)
    details = xkb_dir.stat()
    if details.st_uid != os.getuid() or stat.S_IMODE(details.st_mode) != 0o700:
        report("error", component="xkb", reason="private directory invalid")
        return 1
    xkb_link = xkb_dir / "xkbcomp"
    if not xkb_link.exists():
        xkb_link.symlink_to(OVERLAY / "usr/bin/xkbcomp")
    original = (OVERLAY / "usr/bin/Xtigervnc").read_bytes()
    if original.count(b"/usr/bin\0") != 1:
        report("error", component="xkb", reason="unsupported Xserver build")
        return 1
    patched = STATE / "Xtigervnc-user"
    patched.write_bytes(original.replace(b"/usr/bin\0", b"/tmp/zyn\0", 1))
    patched.chmod(0o700)
    passwd = PRIVATE / "vnc.passwd"
    password = load_vnc_password()
    if password is None:
        return 1
    result = subprocess.run([str(OVERLAY / "usr/bin/tigervncpasswd"), "-f"],
                            input=(password + "\n").encode(), capture_output=True,
                            env=env, timeout=10, check=False)
    del password
    if result.returncode or not result.stdout:
        report("error", component="tigervncpasswd", exit=result.returncode)
        return 1
    passwd.write_bytes(result.stdout)
    passwd.chmod(0o600)
    xserver = start("Xtigervnc", [str(patched), DISPLAY,
                    "-geometry", GEOMETRY, "-depth", "16",
                    "-rfbport", str(VNC_PORT), "-localhost",
                    "-SecurityTypes", "VncAuth", "-PasswordFile", str(passwd),
                    "-nolisten", "tcp"], env)
    for _ in range(40):
        if connected():
            break
        if xserver.poll() is not None:
            report("error", component="Xtigervnc", exit=xserver.returncode)
            return 1
        time.sleep(0.25)
    else:
        report("error", component="Xtigervnc", reason="VNC did not listen")
        return 1
    window_manager = start("jwm", [str(OVERLAY / "usr/bin/jwm"), "-f",
                                   str(HOME / "jwmrc")], env)
    terminal = start("xterm", [str(OVERLAY / "usr/bin/xterm"), "-title",
                               "Terminal Zenyx", "-geometry", "52x11+340+146",
                               "-bg", "#0d1b31", "-fg", "#e5f2ff"], env)
    time.sleep(2)
    report("started", display=DISPLAY, geometry=GEOMETRY, depth=16,
           vnc_loopback=connected(), jwm_running=window_manager.poll() is None,
           xterm_running=terminal.poll() is None,
           screenshot_path=str(STATE / "screenshot.png"))
    if not connected() or window_manager.poll() is not None:
        return 1
    screenshot = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f",
                                 "x11grab", "-video_size", GEOMETRY, "-i", DISPLAY,
                                 "-frames:v", "1", str(STATE / "screenshot.png")],
                                env=env, capture_output=True, timeout=20,
                                check=False)
    image = STATE / "screenshot.png"
    report("capture", success=screenshot.returncode == 0 and image.is_file(),
           bytes=image.stat().st_size if image.is_file() else 0,
           vnc_reconnect_probe=connected())
    graphics_env = dict(env, LIBGL_ALWAYS_SOFTWARE="1", GALLIUM_DRIVER="llvmpipe",
                        EGL_PLATFORM="x11")
    graphics = {}
    for name in ("eglinfo", "glxinfo"):
        try:
            check = subprocess.run([str(OVERLAY / "usr/bin" / name),
                                    *([] if name == "eglinfo" else ["-B"])],
                                   env=graphics_env, capture_output=True,
                                   text=True, timeout=15, check=False)
            selected = [line.strip() for line in check.stdout.splitlines()
                        if any(key in line for key in ("EGL version", "OpenGL ES profile version",
                                                        "OpenGL renderer", "OpenGL core profile version"))]
            graphics[name] = {"exit": check.returncode, "reported": selected[:8],
                              "error": check.stderr.strip().splitlines()[-2:],
                              "first_output": check.stdout.strip().splitlines()[:3]
                              if check.returncode else []}
        except (OSError, subprocess.TimeoutExpired):
            graphics[name] = {"exit": None, "reported": []}
    report("graphics", probes=graphics)
    env["PYTHONPATH"] = str(STATE / "python")
    web = start("websockify", web_command(), env)
    web_http, web_socket = wait_web_ready(web)
    report("web", http_loopback=web_http, websocket_upgrade=web_socket,
           websockify_running=web.poll() is None,
           web_port=WEB_PORT,
           public_endpoint_tested=False)
    if not (web_http and web_socket and web.poll() is None):
        report("error", component="websockify", reason="startup probe failed",
               exit=web.poll())
        return 1
    flags = ""
    try:
        for line in Path("/proc/cpuinfo").read_text().splitlines():
            if line.startswith("flags"):
                flags = line.partition(":")[2]
                break
    except OSError:
        pass
    namespace = None
    if shutil.which("unshare"):
        try:
            test = subprocess.run(["unshare", "-Ur", "true"],
                                  capture_output=True, timeout=5, check=False)
            namespace = test.returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            namespace = False
    report("roblox_prerequisites", sse4_1="sse4_1" in flags,
           sse4_2="sse4_2" in flags, dri=Path("/dev/dri").exists(),
           egl_library=bool(find_library("EGL")),
           gles_library=bool(find_library("GLESv2")),
           flatpak_available=bool(shutil.which("flatpak")),
           user_namespace=namespace)
    plans = {}
    for name, packages in {
        "mesa_probe": ["libegl1", "libgles2", "libgl1-mesa-dri", "mesa-utils-extra"],
        "flatpak": ["flatpak", "bubblewrap"],
    }.items():
        try:
            plan = subprocess.run(["apt-get", "-s", "--no-install-recommends",
                                   "install", *packages], capture_output=True,
                                  text=True, timeout=20, check=False)
            plans[name] = {"exit": plan.returncode,
                           "new_packages": [line.split()[1] for line in plan.stdout.splitlines()
                                            if line.startswith("Inst ")]}
        except (OSError, subprocess.TimeoutExpired):
            plans[name] = {"exit": None, "new_packages": []}
    report("software_graphics_plan", plans=plans)
    if os.environ.get("ZENYX_TEST_APPS") == "1":
        files = start("pcmanfm", ["sh", str(HOME / "launch-files.sh")], env)
        time.sleep(5)
        files_image = STATE / "screenshot-files.png"
        files_capture = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "x11grab",
             "-video_size", GEOMETRY, "-i", DISPLAY, "-frames:v", "1",
             str(files_image)], env=env, capture_output=True, timeout=20, check=False)
        report("files", running=files.poll() is None, exit=files.poll(),
               screenshot=files_capture.returncode == 0 and files_image.is_file(),
               bytes=files_image.stat().st_size if files_image.is_file() else 0)
        test_url = os.environ.get("ZENYX_TEST_URL", "file://" +
                                  str(HOME / ".zenyx/firefox-home/welcome.html"))
        browser = start("firefox", ["sh", str(HOME / "launch-browser.sh"), test_url], env)
        time.sleep(18)
        browser_image = STATE / "screenshot-browser.png"
        browser_capture = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "x11grab",
             "-video_size", GEOMETRY, "-i", DISPLAY, "-frames:v", "1",
             str(browser_image)], env=env, capture_output=True, timeout=20, check=False)
        memory_file = Path("/sys/fs/cgroup/memory.current")
        guard_file = STATE / "firefox-home/guard-report.json"
        try:
            guard = json.loads(guard_file.read_text())
        except (OSError, json.JSONDecodeError):
            guard = None
        report("applications", browser_running=browser.poll() is None,
               browser_exit=browser.poll(), file_manager_running=files.poll() is None,
               browser_guard=guard,
               tested_url=test_url,
               screenshot=browser_capture.returncode == 0 and browser_image.is_file(),
               bytes=browser_image.stat().st_size if browser_image.is_file() else 0,
               memory_bytes=int(memory_file.read_text()) if memory_file.is_file() else None)
    return supervise_web_session(xserver, window_manager, web, env)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, on_stop)
    signal.signal(signal.SIGINT, on_stop)
    try:
        raise SystemExit(main())
    finally:
        for _name, process in reversed(PROCESSES):
            if process.poll() is None:
                process.terminate()
        for _name, process in reversed(PROCESSES):
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
