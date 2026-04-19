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

import datetime as dt
import hashlib
import json
import os
import platform
import queue
import signal
import socket
import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

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
        self.hostname = socket.gethostname()
        self.os_name = platform.system().lower()
        self.device_id: Optional[str] = None
        self.stop_event = threading.Event()
        self.events_queue: "queue.Queue[Dict[str, Any]]" = queue.Queue(maxsize=2000)
        self.last_heartbeat = 0.0
        self.last_flush = 0.0

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
        idle_seconds = self.idle.idle_seconds()
        is_idle = bool(idle_seconds is not None and idle_seconds >= self.cfg.idle_threshold_sec)

        keys_count, mouse_count = self.activity.pull_and_reset()

        event = {
            "ts": utc_now_iso(),
            "event_type": "activity",
            "app_name": app_name,
            "url_domain": None,
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
