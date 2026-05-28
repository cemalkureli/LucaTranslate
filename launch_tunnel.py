#!/usr/bin/env python3
"""
Lingua — Cloudflare Tunnel Launcher
─────────────────────────────────────
Whisper sunucusunu otomatik başlatır ve Cloudflare Tunnel ile
internete açar. Mobil internet dahil her yerden erişilebilir.

Kurulum:
    pip install faster-whisper flask flask-cors requests

Cloudflare cloudflared yükle:
    macOS:   brew install cloudflare/cloudflare/cloudflared
    Linux:   wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb
    Windows: winget install Cloudflare.cloudflared

Çalıştır:
    python launch_tunnel.py
    python launch_tunnel.py --model small   # daha iyi doğruluk
"""

import subprocess
import threading
import time
import re
import sys
import os
import signal
import argparse
import requests

PORT = 9000
TUNNEL_URL = None
processes = []

# ── ANSI renk kodları ────────────────────────────────────────────────────────
G = '\033[92m'; Y = '\033[93m'; R = '\033[91m'; B = '\033[94m'; C = '\033[96m'; W = '\033[0m'

def log(msg, color=W):
    print(f"{color}{msg}{W}")

# ── Whisper sunucusunu başlat ────────────────────────────────────────────────
def start_whisper(model: str, device: str):
    log(f"\n[1/3] Whisper sunucusu başlatılıyor (model={model})...", Y)
    server_script = os.path.join(os.path.dirname(__file__), 'whisper_server.py')
    
    if not os.path.exists(server_script):
        log("✗ whisper_server.py bulunamadı! Aynı klasörde olmalı.", R)
        sys.exit(1)

    proc = subprocess.Popen(
        [sys.executable, server_script, '--model', model, '--device', device, '--port', str(PORT)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    processes.append(proc)

    # Model yüklenene kadar bekle
    log("   Model yükleniyor", Y, end='')
    for line in proc.stdout:
        if 'Model ready' in line or 'ready' in line.lower():
            log(f"\n   ✓ Whisper hazır", G)
            break
        print('.', end='', flush=True)
        if proc.poll() is not None:
            log(f"\n✗ Sunucu başlatılamadı: {line}", R)
            sys.exit(1)

    # Arka planda çıktıları oku
    def drain(p):
        for _ in p.stdout:
            pass
    threading.Thread(target=drain, args=(proc,), daemon=True).start()
    return proc

# ── Cloudflare Tunnel başlat ─────────────────────────────────────────────────
def start_tunnel():
    global TUNNEL_URL
    log(f"\n[2/3] Cloudflare Tunnel açılıyor...", Y)

    try:
        proc = subprocess.Popen(
            ['cloudflared', 'tunnel', '--url', f'http://localhost:{PORT}'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        processes.append(proc)
    except FileNotFoundError:
        log("✗ cloudflared bulunamadı!", R)
        log("  macOS:   brew install cloudflare/cloudflare/cloudflared", Y)
        log("  Linux:   https://developers.cloudflare.com/cloudflared/get-started/linux", Y)
        log("  Windows: winget install Cloudflare.cloudflared", Y)
        sys.exit(1)

    # URL'yi çıktıdan yakala
    url_pattern = re.compile(r'https://[a-z0-9-]+\.trycloudflare\.com')
    for line in proc.stdout:
        match = url_pattern.search(line)
        if match:
            TUNNEL_URL = match.group(0)
            log(f"\n   ✓ Tünel aktif!", G)
            break
        if proc.poll() is not None:
            log(f"\n✗ Tunnel başlatılamadı.", R)
            sys.exit(1)

    # Arka planda oku
    def drain(p):
        for _ in p.stdout:
            pass
    threading.Thread(target=drain, args=(proc,), daemon=True).start()
    return proc

# ── Sağlık kontrolü ─────────────────────────────────────────────────────────
def health_check(url: str, retries: int = 5) -> bool:
    for i in range(retries):
        try:
            r = requests.get(f"{url}/", timeout=8)
            return r.status_code == 200
        except Exception:
            time.sleep(2)
    return False

# ── Temizlik ────────────────────────────────────────────────────────────────
def cleanup(sig=None, frame=None):
    log("\n\n[Kapatılıyor]", Y)
    for p in processes:
        try:
            p.terminate()
        except Exception:
            pass
    log("✓ Kapatıldı.", G)
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

# ── Ana akış ────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Lingua Tunnel Launcher')
    parser.add_argument('--model', default='base',
        choices=['tiny','tiny.en','base','base.en','small','small.en','medium','large-v2','large-v3'])
    parser.add_argument('--device', default='cpu', choices=['cpu', 'cuda'])
    args = parser.parse_args()

    print(f"""
{C}╔══════════════════════════════════════════╗
║      Lingua — Cloudflare Tunnel          ║
╚══════════════════════════════════════════╝{W}
""")

    start_whisper(args.model, args.device)
    time.sleep(1)
    start_tunnel()

    log(f"\n[3/3] Bağlantı test ediliyor...", Y)
    ok = health_check(TUNNEL_URL)

    print(f"""
{G}╔══════════════════════════════════════════╗
║  ✓  HAZIR — Her yerden erişilebilir!     ║
╠══════════════════════════════════════════╣
║                                          ║
║  URL:                                    ║
║  {TUNNEL_URL:<41}║
║                                          ║
║  Lingua Uygulamasında:                   ║
║  Ayarlar → Ses → Local Whisper           ║
║  Server URL → yukarıdaki URL             ║
║                                          ║
║  NOT: URL her yeniden başlatmada         ║
║  değişir (ücretsiz Cloudflare).          ║
║  Sabit URL için: cloudflared login       ║
╚══════════════════════════════════════════╝{W}

{Y}CTRL+C ile kapat{W}
""")

    if not ok:
        log("⚠ Sağlık kontrolü başarısız — sunucu çalışıyor ama tünel yavaş olabilir.", Y)
        log(f"  Manuel test: curl {TUNNEL_URL}/", Y)

    # Sonsuza kadar çalış
    try:
        while True:
            time.sleep(10)
            # Proseslerin hâlâ yaşadığını kontrol et
            for p in processes:
                if p.poll() is not None:
                    log("⚠ Bir proses kapandı! Yeniden başlatılıyor...", R)
                    time.sleep(3)
                    main()
    except KeyboardInterrupt:
        cleanup()

if __name__ == '__main__':
    main()
