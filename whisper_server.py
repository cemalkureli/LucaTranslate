#!/usr/bin/env python3
"""
Lingua Local Whisper Server
────────────────────────────
Offline speech-to-text server compatible with the whisper-asr-webservice API.
Uses faster-whisper for speed, runs on CPU or GPU.

Setup:
    pip install faster-whisper flask flask-cors

Run:
    python whisper_server.py
    python whisper_server.py --model medium --port 9000 --device cpu

Then in Lingua app → Settings → Voice → Local Whisper → http://YOUR_IP:9000
"""

import argparse
import io
import os
import tempfile
import time
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS

# ── Model cache ──────────────────────────────────────────────────────────────
_model = None
_model_name = None

def get_model(model_name: str, device: str, compute_type: str):
    global _model, _model_name
    if _model is None or _model_name != model_name:
        print(f"[Lingua] Loading Whisper model '{model_name}' on {device}...")
        from faster_whisper import WhisperModel
        _model = WhisperModel(model_name, device=device, compute_type=compute_type)
        _model_name = model_name
        print(f"[Lingua] Model ready.")
    return _model

# ── Flask app ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Allow requests from the mobile app

ARGS = None  # set in main()

@app.route("/", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": ARGS.model if ARGS else "unknown",
        "device": ARGS.device if ARGS else "unknown",
    })

@app.route("/asr", methods=["POST"])
def transcribe():
    """
    Compatible with onerahmet/openai-whisper-asr-webservice API.
    Query params:
        language  - BCP-47 language code (optional, auto-detect if omitted)
        output    - 'txt' | 'json' | 'vtt' | 'srt' (default: txt)
    Body:
        audio_file - multipart/form-data audio file (wav, mp3, m4a, ogg, etc.)
    """
    if "audio_file" not in request.files:
        return jsonify({"error": "No audio_file in request"}), 400

    audio_file = request.files["audio_file"]
    language = request.args.get("language") or None  # None = auto
    output_fmt = request.args.get("output", "txt").lower()

    # Save to temp file
    suffix = Path(audio_file.filename or "audio.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        t0 = time.time()
        model = get_model(ARGS.model, ARGS.device, ARGS.compute_type)

        segments, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )

        # Collect segments
        seg_list = list(segments)
        elapsed = time.time() - t0

        full_text = " ".join(s.text.strip() for s in seg_list).strip()

        print(f"[Lingua] Transcribed in {elapsed:.2f}s | lang={info.language} | '{full_text[:60]}...'")

        if output_fmt == "json":
            return jsonify({
                "text": full_text,
                "language": info.language,
                "duration": elapsed,
                "segments": [
                    {"start": s.start, "end": s.end, "text": s.text.strip()}
                    for s in seg_list
                ],
            })
        elif output_fmt in ("vtt", "srt"):
            lines = []
            if output_fmt == "vtt":
                lines.append("WEBVTT\n")
            for i, s in enumerate(seg_list, 1):
                if output_fmt == "srt":
                    lines.append(str(i))
                start = _fmt_time(s.start, srt=(output_fmt == "srt"))
                end   = _fmt_time(s.end,   srt=(output_fmt == "srt"))
                lines.append(f"{start} --> {end}")
                lines.append(s.text.strip())
                lines.append("")
            return "\n".join(lines), 200, {"Content-Type": "text/plain"}
        else:
            # Plain text
            return full_text, 200, {"Content-Type": "text/plain"}

    finally:
        os.unlink(tmp_path)


def _fmt_time(seconds: float, srt: bool = False) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    sep = "," if srt else "."
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", sep)


# ── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Lingua Local Whisper Server")
    parser.add_argument("--model", default="base",
        choices=["tiny", "tiny.en", "base", "base.en", "small", "small.en",
                 "medium", "medium.en", "large-v2", "large-v3"],
        help="Whisper model size (default: base). Larger = more accurate but slower.")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"],
        help="Device to run on (default: cpu)")
    parser.add_argument("--compute-type", default="int8",
        choices=["int8", "int8_float16", "float16", "float32"],
        help="Quantization type (default: int8 for CPU)")
    parser.add_argument("--port", type=int, default=9000,
        help="Port to listen on (default: 9000)")
    parser.add_argument("--host", default="0.0.0.0",
        help="Host to bind (default: 0.0.0.0 = all interfaces)")

    ARGS = parser.parse_args()

    print(f"""
╔══════════════════════════════════════╗
║      Lingua Local Whisper Server     ║
╠══════════════════════════════════════╣
║  Model  : {ARGS.model:<27}║
║  Device : {ARGS.device:<27}║
║  Port   : {ARGS.port:<27}║
╠══════════════════════════════════════╣
║  URL    : http://localhost:{ARGS.port:<11}║
╚══════════════════════════════════════╝

In Lingua app:
  Settings → Voice → Local Whisper
  Server URL: http://<your-ip>:{ARGS.port}

Model sizes & accuracy:
  tiny   → ~39M  params, fastest, lower accuracy
  base   → ~74M  params, good balance (recommended)
  small  → ~244M params, better accuracy
  medium → ~769M params, great accuracy
  large  → ~1550M params, best accuracy, requires 10GB+ RAM
""")

    # Pre-load the model at startup
    get_model(ARGS.model, ARGS.device, ARGS.compute_type)

    app.run(host=ARGS.host, port=ARGS.port, debug=False, threaded=True)
