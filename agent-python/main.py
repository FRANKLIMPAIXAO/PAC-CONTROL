#!/usr/bin/env python3
"""PAC CONTROL desktop agent (Python MVP).

Coleta apenas metadados operacionais:
- app em foco
- status idle
- contagem estatistica de teclado/mouse (sem conteudo)

Envia dados para:
- /api/agent/register-device
- /api/agent/heartbeat
- /api/agent/events-batch
"""

from __future__ import annotations

import base64
import datetime as dt
import hashlib
import io
import json
import os
import platform
import queue
import signal
import socket
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

import requests

try:
    import psutil
except Exception:  # pragma: no cover
    psutil = None


@dataclass
class AgentConfig:
    api_base_url: str
    api_token: str
    user_id: str
    agent_version: str = "0.1.0"
    sample_interval_sec: int = 10
    heartbeat_interval_sec: int = 30
    flush_interval_sec: int = 20
    batch_size: int = 50
    idle_threshold_sec: int = 300
    verify_tls: bool = True
    request_timeout_sec: int = 10
    enable_screenshots: bool = True
    screenshot_interval_sec: int = 60
    screenshot_max_width: int = 1600
    screenshot_quality: int = 55
    screenshot_only_when_active: bool = True


def load_config() -> AgentConfig:
    config_path = os.getenv("PAC_AGENT_CONFIG", "config.json")
    with open(config_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    required = ["api_base_url", "api_token", "user_id"]
    missing = [k for k in required if not raw.get(k)]
    if missing:
        raise ValueError(f"Campos obrigatorios ausentes no config: {', '.join(missing)}")

    return AgentConfig(**raw)


def utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def hash_text(value: str) -> str:
    if not value:
        return ""
    digest = hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()
    return f"sha256:{digest}"


class ActivityCounter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._keys = 0
        self._mouse = 0
        self._listeners = []

    def start(self) -> None:
        try:
            from pynput import keyboard, mouse  # type: ignore
        except Exception:
            print("[agent] pynput indisponivel. Seguindo sem contadores de teclado/mouse.")
            return

        def on_key(_key: Any) -> None:
            with self._lock:
                self._keys += 1

        def on_click(_x: int, _y: int, _button: Any, pressed: bool) -> None:
            if not pressed:
                return
            with self._lock:
                self._mouse += 1

        kb_listener = keyboard.Listener(on_press=on_key)
        ms_listener = mouse.Listener(on_click=on_click)
        kb_listener.daemon = True
        ms_listener.daemon = True
        kb_listener.start()
        ms_listener.start()
        self._listeners = [kb_listener, ms_listener]
        print("[agent] Contadores estatisticos de teclado/mouse ativos.")

    def pull_and_reset(self) -> Tuple[int, int]:
        with self._lock:
            keys = self._keys
            mouse = self._mouse
            self._keys = 0
            self._mouse = 0
        return keys, mouse


class ForegroundDetector:
    def __init__(self) -> None:
        self.system = platform.system().lower()

    def detect(self) -> Tuple[Optional[str], Optional[str]]:
        if self.system == "windows":
            return self._detect_windows()
        if self.system == "darwin":
            return self._detect_macos()
        if self.system == "linux":
            return self._detect_linux()
        return None, None

    def _detect_windows(self) -> Tuple[Optional[str], Optional[str]]:
        try:
            import ctypes
            from ctypes import wintypes

            user32 = ctypes.windll.user32
            hwnd = user32.GetForegroundWindow()
            if not hwnd:
                return None, None

            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

            title_buf = ctypes.create_unicode_buffer(512)
            user32.GetWindowTextW(hwnd, title_buf, 512)
            title = title_buf.value or None

            app_name = None
            if psutil and pid.value:
                try:
                    app_name = psutil.Process(pid.value).name()
                except Exception:
                    app_name = None

            return app_name, title
        except Exception:
            return None, None

    def _detect_macos(self) -> Tuple[Optional[str], Optional[str]]:
        try:
            cmd = [
                "osascript",
                "-e",
                'tell application "System Events" to get name of first application process whose frontmost is true',
            ]
            app_name = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode("utf-8", errors="ignore").strip()
            return (app_name or None), None
        except Exception:
            return None, None

    def _detect_linux(self) -> Tuple[Optional[str], Optional[str]]:
        try:
            window_name = subprocess.check_output(
                ["xdotool", "getwindowfocus", "getwindowname"], stderr=subprocess.DEVNULL
            ).decode("utf-8", errors="ignore").strip()
            return None, (window_name or None)
        except Exception:
            return None, None


class IdleDetector:
    def __init__(self) -> None:
        self.system = platform.system().lower()

    def idle_seconds(self) -> Optional[int]:
        if self.system == "windows":
            return self._idle_windows()
        if self.system == "darwin":
            return self._idle_macos()
        if self.system == "linux":
            return self._idle_linux()
        return None

    def _idle_windows(self) -> Optional[int]:
        try:
            import ctypes

            class LASTINPUTINFO(ctypes.Structure):
                _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32

            lii = LASTINPUTINFO()
            lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
            if not user32.GetLastInputInfo(ctypes.byref(lii)):
                return None

            millis = kernel32.GetTickCount() - lii.dwTime
            return max(0, int(millis / 1000))
        except Exception:
            return None

    def _idle_macos(self) -> Optional[int]:
        try:
            import Quartz  # type: ignore

            sec = Quartz.CGEventSourceSecondsSinceLastEventType(
                Quartz.kCGEventSourceStateCombinedSessionState,
                Quartz.kCGAnyInputEventType,
            )
            return int(sec)
        except Exception:
            return None

    def _idle_linux(self) -> Optional[int]:
        try:
            out = subprocess.check_output(["xprintidle"], stderr=subprocess.DEVNULL).decode("utf-8").strip()
            return max(0, int(int(out) / 1000))
        except Exception:
            return None


class DomainDetector:
    def __init__(self) -> None:
        self.system = platform.system().lower()
        self._warned_permission = False
        self._mac_browser_scripts = {
            "google chrome": 'tell application "Google Chrome" to if (count of windows) > 0 then get URL of active tab of front window',
            "microsoft edge": 'tell application "Microsoft Edge" to if (count of windows) > 0 then get URL of active tab of front window',
            "brave browser": 'tell application "Brave Browser" to if (count of windows) > 0 then get URL of active tab of front window',
            "opera": 'tell application "Opera" to if (count of windows) > 0 then get URL of active tab of front window',
            "vivaldi": 'tell application "Vivaldi" to if (count of windows) > 0 then get URL of active tab of front window',
            "arc": 'tell application "Arc" to if (count of windows) > 0 then get URL of active tab of front window',
            "safari": 'tell application "Safari" to if (count of windows) > 0 then get URL of front document',
        }

    def detect_domain(self, app_name: Optional[str], window_title: Optional[str]) -> Optional[str]:
        if self.system == "darwin":
            domain = self._domain_macos(app_name)
            if domain:
                return domain

        # Fallback generico: so tenta extrair se houver URL visivel no titulo.
        if window_title:
            parsed = self._normalize_url(window_title.strip())
            if parsed:
                return parsed
        return None

    def _domain_macos(self, app_name: Optional[str]) -> Optional[str]:
        if not app_name:
            return None
        script = self._mac_browser_scripts.get(app_name.strip().lower())
        if not script:
            return None
        url = self._run_osascript(script)
        if not url:
            return None
        return self._normalize_url(url)

    def _run_osascript(self, script: str) -> Optional[str]:
        try:
            out = subprocess.check_output(
                ["osascript", "-e", script],
                stderr=subprocess.DEVNULL,
                timeout=2,
            ).decode("utf-8", errors="ignore").strip()
            return out or None
        except Exception:
            # Sem permissao de automacao no macOS, manter silencioso apos primeiro aviso.
            if not self._warned_permission:
                print("[agent] aviso: sem permissao para ler URL do navegador (Automacao no macOS).")
                self._warned_permission = True
            return None

    def _normalize_url(self, raw: str) -> Optional[str]:
        try:
            value = raw.strip()
            if not value:
                return None
            if "://" not in value:
                return None

            parsed = urlparse(value)
            host = (parsed.hostname or "").lower().strip()
            if not host:
                return None
            if host.startswith("www."):
                host = host[4:]
            return host or None
        except Exception:
            return None


class ScreenshotCapture:
    def __init__(self, cfg: AgentConfig) -> None:
        self.cfg = cfg
        self.system = platform.system().lower()
        self._warned = False
        self._warned_skip = False
        self._mss = None
        self._image_mod = None
        self._skip_apps = {
            "finder",
            "loginwindow",
            "dock",
            "control center",
            "spotlight",
        }

    def _lazy_import(self) -> bool:
        if self._mss and self._image_mod:
            return True
        try:
            import mss  # type: ignore
            from PIL import Image  # type: ignore

            self._mss = mss
            self._image_mod = Image
            return True
        except Exception:
            if not self._warned:
                print("[agent] screenshot desativado: dependencias ausentes (mss/Pillow).")
                self._warned = True
            return False

    def capture_base64(self, app_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if self.system == "darwin":
            return self._capture_macos_active_window(app_name)
        return self._capture_fullscreen()

    def _capture_fullscreen(self) -> Optional[Dict[str, Any]]:
        if not self._lazy_import():
            return None
        try:
            with self._mss.mss() as sct:
                monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
                shot = sct.grab(monitor)
                image = self._image_mod.frombytes("RGB", shot.size, shot.rgb)
                return self._encode_image(image)
        except Exception:
            if not self._warned:
                print("[agent] aviso: falha ao capturar screenshot (verifique permissao de Gravacao de Tela).")
                self._warned = True
            return None

    def _capture_macos_active_window(self, app_name: Optional[str]) -> Optional[Dict[str, Any]]:
        app = (app_name or "").strip().lower()
        if not app or app in self._skip_apps:
            if not self._warned_skip:
                print("[agent] screenshot ignorado para app de sistema/desktop.")
                self._warned_skip = True
            return None

        window_id = self._find_macos_window_id(app)
        if not window_id:
            return None

        if not self._lazy_import():
            return None

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                temp_path = tmp.name

            subprocess.run(
                ["screencapture", "-x", "-l", str(window_id), temp_path],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
            )

            if not temp_path or not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                return None

            image = self._image_mod.open(temp_path).convert("RGB")
            return self._encode_image(image)
        except Exception:
            if not self._warned:
                print("[agent] aviso: falha ao capturar janela ativa (verifique permissao de Gravacao de Tela).")
                self._warned = True
            return None
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

    def _find_macos_window_id(self, app_name_lower: str) -> Optional[int]:
        try:
            import Quartz  # type: ignore

            windows = Quartz.CGWindowListCopyWindowInfo(
                Quartz.kCGWindowListOptionOnScreenOnly,
                Quartz.kCGNullWindowID,
            )
            if not windows:
                return None

            best_window_id: Optional[int] = None
            best_area = 0.0

            for window in windows:
                owner = (window.get("kCGWindowOwnerName") or "").strip().lower()
                if owner != app_name_lower:
                    continue

                layer = int(window.get("kCGWindowLayer", 1))
                alpha = float(window.get("kCGWindowAlpha", 1))
                if layer != 0 or alpha <= 0:
                    continue

                bounds = window.get("kCGWindowBounds") or {}
                width = float(bounds.get("Width", 0))
                height = float(bounds.get("Height", 0))
                area = width * height
                if area < 20000:
                    continue

                window_id = window.get("kCGWindowNumber")
                if window_id is None:
                    continue

                if area > best_area:
                    best_area = area
                    best_window_id = int(window_id)

            return best_window_id
        except Exception:
            return None

    def _encode_image(self, image: Any) -> Dict[str, Any]:
        max_width = max(320, int(self.cfg.screenshot_max_width))
        if image.width > max_width:
            ratio = max_width / float(image.width)
            target_h = max(180, int(image.height * ratio))
            image = image.resize((max_width, target_h))

        quality = min(95, max(30, int(self.cfg.screenshot_quality)))
        buff = io.BytesIO()
        image.save(buff, format="JPEG", quality=quality, optimize=True)
        raw = buff.getvalue()
        encoded = base64.b64encode(raw).decode("ascii")

        return {
            "image_base64": encoded,
            "mime_type": "image/jpeg",
            "width": image.width,
            "height": image.height,
        }


class ApiClient:
    def __init__(self, cfg: AgentConfig):
        self.cfg = cfg
        self.base_url = cfg.api_base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {cfg.api_token}",
            "Content-Type": "application/json",
            "User-Agent": f"pac-control-agent/{cfg.agent_version}",
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    def post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        resp = self.session.post(
            url,
            data=json.dumps(payload),
            timeout=self.cfg.request_timeout_sec,
            verify=self.cfg.verify_tls,
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"HTTP {resp.status_code} em {path}: {resp.text[:300]}")
        return resp.json()


class Agent:
    def __init__(self, cfg: AgentConfig):
        self.cfg = cfg
        self.client = ApiClient(cfg)
        self.activity = ActivityCounter()
        self.foreground = ForegroundDetector()
        self.idle = IdleDetector()
        self.domain = DomainDetector()
        self.screenshot = ScreenshotCapture(cfg)
        self.hostname = socket.gethostname()
        self.os_name = platform.system().lower()
        self.device_id: Optional[str] = None
        self.stop_event = threading.Event()
        self.events_queue: "queue.Queue[Dict[str, Any]]" = queue.Queue(maxsize=2000)
        self.last_heartbeat = 0.0
        self.last_flush = 0.0
        self.last_screenshot = 0.0

    def register_device(self) -> None:
        payload = {
            "user_id": self.cfg.user_id,
            "hostname": self.hostname,
            "os": self.os_name,
            "agent_version": self.cfg.agent_version,
        }
        data = self.client.post("/api/agent/register-device", payload)
        self.device_id = data["device"]["id"]
        print(f"[agent] device registrado: {self.device_id}")

    def send_heartbeat_if_due(self, is_idle: bool) -> None:
        now = time.time()
        if now - self.last_heartbeat < self.cfg.heartbeat_interval_sec:
            return
        if not self.device_id:
            return
        self.client.post("/api/agent/heartbeat", {"device_id": self.device_id, "is_idle": is_idle})
        self.last_heartbeat = now

    def sample_event(self) -> Dict[str, Any]:
        app_name, window_title = self.foreground.detect()
        url_domain = self.domain.detect_domain(app_name, window_title)
        idle_seconds = self.idle.idle_seconds()
        is_idle = bool(idle_seconds is not None and idle_seconds >= self.cfg.idle_threshold_sec)

        keys_count, mouse_count = self.activity.pull_and_reset()

        event = {
            "ts": utc_now_iso(),
            "event_type": "activity",
            "app_name": app_name,
            "url_domain": url_domain,
            "window_hash": hash_text(window_title or ""),
            "is_idle": is_idle,
            "keys_count": keys_count,
            "mouse_count": mouse_count,
            "payload_json": {
                "idle_seconds": idle_seconds,
                "hostname": self.hostname,
            },
        }
        return event

    def enqueue_event(self, event: Dict[str, Any]) -> None:
        try:
            self.events_queue.put_nowait(event)
        except queue.Full:
            _ = self.events_queue.get_nowait()
            self.events_queue.put_nowait(event)

    def send_screenshot_if_due(self, event: Dict[str, Any]) -> None:
        if not self.cfg.enable_screenshots:
            return
        if not self.device_id:
            return
        if self.cfg.screenshot_only_when_active and bool(event.get("is_idle")):
            return

        now = time.time()
        if (now - self.last_screenshot) < max(10, self.cfg.screenshot_interval_sec):
            return

        shot = self.screenshot.capture_base64(event.get("app_name"))
        if not shot:
            return

        payload = {
            "device_id": self.device_id,
            "user_id": self.cfg.user_id,
            "ts": event.get("ts") or utc_now_iso(),
            "app_name": event.get("app_name"),
            "url_domain": event.get("url_domain"),
            "is_idle": bool(event.get("is_idle")),
            "image_base64": shot["image_base64"],
            "mime_type": shot["mime_type"],
            "width": shot["width"],
            "height": shot["height"],
        }
        self.client.post("/api/agent/screenshot", payload)
        self.last_screenshot = now
        print("[agent] screenshot enviado.")

    def flush_if_due(self, force: bool = False) -> None:
        if not self.device_id:
            return

        now = time.time()
        if not force and self.events_queue.qsize() < self.cfg.batch_size and (now - self.last_flush) < self.cfg.flush_interval_sec:
            return

        batch = []
        while not self.events_queue.empty() and len(batch) < self.cfg.batch_size:
            batch.append(self.events_queue.get_nowait())

        if not batch:
            return

        payload = {"device_id": self.device_id, "user_id": self.cfg.user_id, "events": batch}
        self.client.post("/api/agent/events-batch", payload)
        self.last_flush = now
        print(f"[agent] batch enviado: {len(batch)} eventos")

    def run(self) -> None:
        self.activity.start()
        self.register_device()

        print("[agent] iniciado.")
        print(
            f"[agent] coleta a cada {self.cfg.sample_interval_sec}s, heartbeat {self.cfg.heartbeat_interval_sec}s, batch {self.cfg.batch_size}."
        )

        while not self.stop_event.is_set():
            try:
                event = self.sample_event()
                self.enqueue_event(event)
                self.send_heartbeat_if_due(bool(event.get("is_idle")))
                self.send_screenshot_if_due(event)
                self.flush_if_due(force=False)
            except Exception as exc:
                print(f"[agent] erro no ciclo: {exc}")

            self.stop_event.wait(self.cfg.sample_interval_sec)

        print("[agent] parada solicitada, enviando fila restante...")
        try:
            self.flush_if_due(force=True)
        except Exception as exc:
            print(f"[agent] erro no flush final: {exc}")



def main() -> None:
    cfg = load_config()
    agent = Agent(cfg)

    def _graceful_stop(_sig: int, _frame: Any) -> None:
        agent.stop_event.set()

    signal.signal(signal.SIGINT, _graceful_stop)
    signal.signal(signal.SIGTERM, _graceful_stop)

    # Retry simples para startup, util em reboot de maquina com API subindo junto
    retries = 8
    for attempt in range(1, retries + 1):
        try:
            agent.run()
            break
        except Exception as exc:
            if attempt == retries:
                raise
            wait_sec = min(60, 2 ** attempt)
            print(f"[agent] falha ao iniciar ({exc}). Tentativa {attempt}/{retries}. Novo retry em {wait_sec}s")
            time.sleep(wait_sec)


if __name__ == "__main__":
    main()
