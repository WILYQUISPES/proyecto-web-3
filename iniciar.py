"""
PasoFirme — Launcher
====================
Levanta el backend Node y el frontend Vite en un solo paso.
Solo requiere Python 3.10+ stdlib (sin pip install).

Uso:
    python iniciar.py
    (o doble clic si Python esta asociado a .py)
"""

import os
import sys
import time
import json
import socket
import signal
import subprocess
import threading
import webbrowser
import urllib.request
import urllib.error
from pathlib import Path

# =================================================================
# Constantes
# =================================================================

PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

BACKEND_PORT = 4000
FRONTEND_PORT = 5173

BACKEND_HEALTH_URL = f"http://localhost:{BACKEND_PORT}/api/health"
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}/"

WAIT_TIMEOUT = 45
IS_WINDOWS = os.name == "nt"

# =================================================================
# Colores ANSI (Windows 10+ los soporta si "encendemos" la terminal)
# =================================================================

if IS_WINDOWS:
    os.system("")

C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_DIM = "\033[2m"
C_GREEN = "\033[32m"
C_YELLOW = "\033[33m"
C_RED = "\033[31m"
C_CYAN = "\033[36m"
C_BLUE = "\033[34m"
C_MAGENTA = "\033[35m"
C_INK = "\033[38;5;94m"     # leather
C_COGNAC = "\033[38;5;130m"
C_GREY = "\033[38;5;245m"

# Estado global de procesos
processes = []
shutting_down = False


# =================================================================
# Helpers de impresion
# =================================================================

def banner():
    print(flush=True)
    print(C_INK + "===============================================" + C_RESET, flush=True)
    print(C_BOLD + "   PASOFIRME" + C_RESET + C_GREY + " - Sistema de Gestion de Calzado" + C_RESET, flush=True)
    print(C_INK + "===============================================" + C_RESET, flush=True)
    print(flush=True)


def step(n, total, msg):
    print(C_BOLD + f"[{n}/{total}]" + C_RESET + f" {msg}", end="", flush=True)


def step_ok(extra=""):
    print(" " + C_GREEN + "OK" + C_RESET + (" " + C_DIM + extra + C_RESET if extra else ""), flush=True)


def step_fail(extra=""):
    print(" " + C_RED + "FALLO" + C_RESET + (" " + extra if extra else ""), flush=True)


def info(msg):
    print("      " + C_DIM + msg + C_RESET, flush=True)


def error(msg):
    print(C_RED + "[ERROR] " + msg + C_RESET, flush=True)


def warn(msg):
    print(C_YELLOW + "[AVISO] " + msg + C_RESET, flush=True)


# =================================================================
# Helpers de sistema
# =================================================================

def check_command(cmd):
    """True si el comando existe en PATH (devuelve version u otra salida)."""
    try:
        exe = cmd
        if IS_WINDOWS and cmd in ("npm", "npx"):
            exe = cmd + ".cmd"
        result = subprocess.run(
            [exe, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
            shell=False,
        )
        return result.returncode == 0, (result.stdout or "").strip()
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False, ""


def port_in_use(port):
    """True si el puerto esta ocupado en localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        try:
            s.connect(("127.0.0.1", port))
            return True
        except (socket.timeout, ConnectionRefusedError, OSError):
            return False


def kill_port(port):
    """Mata el proceso (y su arbol de hijos) que ocupa el puerto."""
    if IS_WINDOWS:
        try:
            out = subprocess.run(
                ["netstat", "-ano", "-p", "tcp"],
                capture_output=True, text=True, timeout=10,
            ).stdout or ""
            pids = set()
            needle = f":{port}"
            for line in out.splitlines():
                if needle in line and ("LISTENING" in line or "ESCUCHANDO" in line):
                    parts = line.split()
                    pid = parts[-1] if parts else ""
                    if pid.isdigit() and pid != "0":
                        pids.add(pid)
            for pid in pids:
                try:
                    # /T mata el arbol entero (importante para node/npm)
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", pid],
                        capture_output=True, timeout=5,
                    )
                except Exception:
                    pass
            # Re-chequeo: si despues de matar sigue ocupado, hacer otro pase
            if pids:
                time.sleep(0.3)
                out2 = subprocess.run(
                    ["netstat", "-ano", "-p", "tcp"],
                    capture_output=True, text=True, timeout=10,
                ).stdout or ""
                for line in out2.splitlines():
                    if needle in line and ("LISTENING" in line or "ESCUCHANDO" in line):
                        parts = line.split()
                        pid = parts[-1] if parts else ""
                        if pid.isdigit() and pid != "0":
                            try:
                                subprocess.run(
                                    ["taskkill", "/F", "/T", "/PID", pid],
                                    capture_output=True, timeout=5,
                                )
                            except Exception:
                                pass
        except Exception:
            pass
    else:
        try:
            out = subprocess.run(
                ["lsof", "-ti", f"tcp:{port}"],
                capture_output=True, text=True, timeout=5,
            ).stdout
            for pid in out.split():
                try:
                    os.kill(int(pid), signal.SIGKILL)
                except Exception:
                    pass
        except Exception:
            pass


def wait_for_url(url, timeout=WAIT_TIMEOUT, interval=0.5):
    """Espera hasta que la URL responda 2xx. Devuelve True/False."""
    start = time.time()
    last_err = None
    while time.time() - start < timeout:
        if shutting_down:
            return False
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "PasoFirme-Launcher"})
            with urllib.request.urlopen(req, timeout=2) as r:
                if 200 <= r.status < 300:
                    return True
        except Exception as e:
            last_err = e
        time.sleep(interval)
    if last_err:
        info(f"Ultimo error: {type(last_err).__name__}")
    return False


# =================================================================
# Lanzar procesos
# =================================================================

def stream_reader(proc, prefix, color):
    """Lee stdout del subprocess y lo reimprime con prefijo."""
    try:
        for line in iter(proc.stdout.readline, ""):
            if shutting_down:
                break
            line = line.rstrip("\r\n")
            if not line:
                continue
            print(color + f"  [{prefix}]" + C_RESET + " " + line)
    except Exception:
        pass
    finally:
        try:
            proc.stdout.close()
        except Exception:
            pass


def spawn(cmd, cwd, prefix, color):
    """Lanza un proceso, redirige stdout y stderr a un thread reader."""
    if IS_WINDOWS:
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        creationflags = 0
    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        universal_newlines=True,
        encoding="utf-8",
        errors="replace",
        shell=False,
        creationflags=creationflags,
    )
    processes.append((proc, prefix))
    t = threading.Thread(target=stream_reader, args=(proc, prefix, color), daemon=True)
    t.start()
    return proc


# =================================================================
# Instalacion de dependencias
# =================================================================

def needs_install(folder):
    return not (folder / "node_modules").exists()


def npm_install(folder, label):
    """Corre npm install de forma sincrona, mostrando una linea por progreso."""
    print()
    info(f"Instalando dependencias de {label} (puede tardar 30-90 seg)...")
    npm = "npm.cmd" if IS_WINDOWS else "npm"
    try:
        proc = subprocess.Popen(
            [npm, "install", "--no-audit", "--no-fund", "--loglevel=error"],
            cwd=str(folder),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=1,
            universal_newlines=True,
            encoding="utf-8",
            errors="replace",
        )
        for line in iter(proc.stdout.readline, ""):
            line = line.rstrip()
            if line:
                print(C_DIM + "      " + line[:120] + C_RESET)
        proc.wait()
        if proc.returncode != 0:
            error(f"npm install fallo (exit {proc.returncode}) en {label}")
            return False
        return True
    except FileNotFoundError:
        error(f"npm no encontrado al instalar {label}")
        return False
    except Exception as e:
        error(f"Error instalando {label}: {e}")
        return False


# =================================================================
# Cleanup
# =================================================================

def cleanup():
    global shutting_down
    if shutting_down:
        return
    shutting_down = True
    print(flush=True)
    print(C_YELLOW + "Cerrando servidores..." + C_RESET, flush=True)
    for proc, prefix in processes:
        try:
            if proc.poll() is None:
                if IS_WINDOWS:
                    # /T mata el arbol completo (npm -> node -> vite, etc.)
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                        capture_output=True, timeout=5,
                    )
                else:
                    proc.terminate()
                    try:
                        proc.wait(timeout=4)
                    except subprocess.TimeoutExpired:
                        proc.kill()
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    # Asegurar que los puertos quedan libres (por si algun zombie quedo)
    time.sleep(0.5)
    kill_port(BACKEND_PORT)
    kill_port(FRONTEND_PORT)
    print(C_GREEN + "Listo. Servidores detenidos." + C_RESET, flush=True)


def install_signal_handlers():
    def handler(_signum, _frame):
        cleanup()
        sys.exit(0)
    signal.signal(signal.SIGINT, handler)
    if hasattr(signal, "SIGTERM"):
        try: signal.signal(signal.SIGTERM, handler)
        except Exception: pass
    if hasattr(signal, "SIGBREAK"):  # Windows Ctrl+Break
        try: signal.signal(signal.SIGBREAK, handler)
        except Exception: pass
    # atexit como red de seguridad si algo escapa al handler
    import atexit
    atexit.register(cleanup)


# =================================================================
# Main
# =================================================================

def main():
    banner()
    install_signal_handlers()

    # [1/7] Node y npm
    step(1, 7, "Verificando Node.js y npm...                  ")
    node_ok, node_v = check_command("node")
    npm_ok, npm_v = check_command("npm")
    if not (node_ok and npm_ok):
        step_fail()
        print()
        error("Falta Node.js o npm. Instala desde https://nodejs.org/  (recomendado v22+)")
        sys.exit(1)
    step_ok(f"node {node_v}, npm {npm_v}")

    # [2/7] Carpetas
    step(2, 7, "Verificando carpetas del proyecto...           ")
    missing = []
    if not (BACKEND_DIR / "package.json").exists():
        missing.append("backend/package.json")
    if not (FRONTEND_DIR / "package.json").exists():
        missing.append("frontend/package.json")
    if missing:
        step_fail()
        for m in missing:
            error(f"Falta: {m}")
        sys.exit(1)
    step_ok()

    # [3/7] Instalar dependencias si falta
    step(3, 7, "Verificando node_modules...                    ")
    back_need = needs_install(BACKEND_DIR)
    front_need = needs_install(FRONTEND_DIR)
    if not back_need and not front_need:
        step_ok("ya estan instaladas")
    else:
        step_ok("hay que instalar")
        if back_need and not npm_install(BACKEND_DIR, "backend"):
            sys.exit(1)
        if front_need and not npm_install(FRONTEND_DIR, "frontend"):
            sys.exit(1)
        info("Dependencias instaladas.")

    # [4/7] Liberar puertos
    step(4, 7, f"Liberando puertos {BACKEND_PORT} y {FRONTEND_PORT}...           ")
    killed_back = port_in_use(BACKEND_PORT)
    killed_front = port_in_use(FRONTEND_PORT)
    if killed_back:
        kill_port(BACKEND_PORT)
    if killed_front:
        kill_port(FRONTEND_PORT)
    time.sleep(1 if (killed_back or killed_front) else 0)
    extra = []
    if killed_back: extra.append("backend muerto")
    if killed_front: extra.append("frontend muerto")
    step_ok(", ".join(extra) if extra else "")

    # [5/7] Lanzar backend
    step(5, 7, f"Arrancando backend en :{BACKEND_PORT}...                ")
    print()
    try:
        spawn(
            ["node", "src/server.js"],
            cwd=BACKEND_DIR,
            prefix="BACK",
            color=C_CYAN,
        )
    except FileNotFoundError:
        step_fail()
        error("No se encontro 'node'. Verifica la instalacion.")
        sys.exit(1)
    info(f"Esperando respuesta de {BACKEND_HEALTH_URL}...")
    if not wait_for_url(BACKEND_HEALTH_URL, timeout=WAIT_TIMEOUT):
        error("Backend no respondio a tiempo. Revisa los logs arriba.")
        cleanup()
        sys.exit(1)
    info(C_GREEN + "Backend respondiendo OK" + C_RESET)

    # [6/7] Lanzar frontend
    step(6, 7, f"Arrancando frontend en :{FRONTEND_PORT}...               ")
    print()
    npm = "npm.cmd" if IS_WINDOWS else "npm"
    try:
        spawn(
            [npm, "run", "dev"],
            cwd=FRONTEND_DIR,
            prefix="FRONT",
            color=C_MAGENTA,
        )
    except FileNotFoundError:
        step_fail()
        error("No se encontro 'npm'. Verifica la instalacion.")
        cleanup()
        sys.exit(1)
    info(f"Esperando respuesta de {FRONTEND_URL}...")
    if not wait_for_url(FRONTEND_URL, timeout=WAIT_TIMEOUT):
        error("Frontend no respondio a tiempo. Revisa los logs arriba.")
        cleanup()
        sys.exit(1)
    info(C_GREEN + "Frontend respondiendo OK" + C_RESET)

    # [7/7] Abrir navegador (en un thread para no bloquear)
    step(7, 7, "Abriendo navegador...                          ")
    def _open_browser():
        try:
            webbrowser.open(FRONTEND_URL, new=2)
        except Exception:
            pass
    threading.Thread(target=_open_browser, daemon=True).start()
    step_ok()

    # Mensaje final (flush forzado para que aparezca aunque webbrowser tarde)
    print(flush=True)
    print(C_INK + "===============================================" + C_RESET, flush=True)
    print(C_BOLD + C_GREEN + "   LISTO PARA USAR" + C_RESET, flush=True)
    print(C_INK + "-----------------------------------------------" + C_RESET, flush=True)
    print(f"   App:      {C_CYAN}{FRONTEND_URL}{C_RESET}", flush=True)
    print(f"   API:      {C_CYAN}http://localhost:{BACKEND_PORT}{C_RESET}", flush=True)
    print(flush=True)
    print(C_BOLD + "   Usuarios demo:" + C_RESET, flush=True)
    print(f"     admin    / Admin123!   {C_DIM}(ve todo){C_RESET}", flush=True)
    print(f"     usuario  / User1234!   {C_DIM}(usuario regular){C_RESET}", flush=True)
    print(flush=True)
    print(C_DIM + "   Presiona Ctrl+C para detener todo." + C_RESET, flush=True)
    print(C_INK + "===============================================" + C_RESET, flush=True)
    print(flush=True)

    # Loop principal - esperar a que muera algun proceso o Ctrl+C
    try:
        while True:
            time.sleep(1)
            for proc, prefix in list(processes):
                code = proc.poll()
                if code is not None:
                    warn(f"El proceso [{prefix}] se cerro inesperadamente (exit {code}).")
                    cleanup()
                    sys.exit(1)
    except KeyboardInterrupt:
        cleanup()
        sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        cleanup()
        sys.exit(0)
    except SystemExit:
        raise
    except Exception as e:
        error(f"Error inesperado: {e}")
        cleanup()
        sys.exit(1)
