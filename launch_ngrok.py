#!/usr/bin/env python3
"""
Lingua — ngrok Tunnel Launcher (Alternatif)
────────────────────────────────────────────
Cloudflare yerine ngrok kullanmak isteyenler için.

Kurulum:
    pip install faster-whisper flask flask-cors pyngrok

ngrok yükle: https://ngrok.com/download
ngrok hesabı aç: https://dashboard.ngrok.com → AuthToken al

Çalıştır:
    python launch_ngrok.py --token YOUR_NGROK_TOKEN
    python launch_ngrok.py --token YOUR_TOKEN --model small
"""

import subprocess
import threading
import time
import sys
import os
import signal
import argparse

PORT = 9000
processes = []

G = '\033[92m'; Y = '\033[93m'; R = '\033[91m'; C = '\033[96m'; W = '\033[0m'

def start_whisper(model: str, device: str):
    print(f"{Y}[1/2] Whisper başlatılıyor...{W}")
    server_script = os.path.join(os.path.dirname(__file__), 'whisper_server.py')
    proc = subprocess.Popen(
        [sys.executable, server_script, '--model', model, '--device', device, '--port', str(PORT)],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1
    )
    processes.append(proc)
    print("   Model yükleniyor", end='')
    for line in proc.stdout:
        if 'ready' in line.lower():
            print(f"\n{G}   ✓ Whisper hazır{W}")
            break
        print('.', end='', flush=True)
    threading.Thread(target=lambda: [_ for _ in proc.stdout], daemon=True).start()

def cleanup(sig=None, frame=None):
    for p in processes:
        try: p.terminate()
        except: pass
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--token', required=True, help='ngrok AuthToken')
    parser.add_argument('--model', default='base')
    parser.add_argument('--device', default='cpu')
    args = parser.parse_args()

    start_whisper(args.model, args.device)

    print(f"\n{Y}[2/2] ngrok tüneli açılıyor...{W}")
    try:
        from pyngrok import ngrok, conf
        conf.get_default().auth_token = args.token
        tunnel = ngrok.connect(PORT, "http")
        url = tunnel.public_url

        print(f"""
{G}╔══════════════════════════════════════════╗
║  ✓  HAZIR!                               ║
╠══════════════════════════════════════════╣
║  URL: {url:<36}║
║                                          ║
║  Lingua → Ayarlar → Ses → Local Whisper  ║
╚══════════════════════════════════════════╝{W}

{Y}CTRL+C ile kapat{W}
""")
        # Bekle
        while True:
            time.sleep(30)
    except ImportError:
        print(f"{R}pyngrok yüklü değil: pip install pyngrok{W}")
        cleanup()

if __name__ == '__main__':
    main()
