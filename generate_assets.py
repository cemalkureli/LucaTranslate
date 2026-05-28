#!/usr/bin/env python3
"""
Lingua — Asset Generator
Expo için gerekli tüm icon ve splash screen'leri oluşturur.
Pillow kütüphanesi gerekir: pip install Pillow

Çalıştır (LinguaApp klasöründe):
    python generate_assets.py
"""

import os
import math

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow yüklü değil. Yükleniyor...")
    os.system("pip install Pillow")
    from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")
os.makedirs(ASSETS_DIR, exist_ok=True)

BG        = (0, 0, 0)          # Siyah
PURPLE    = (220, 38, 38)      # Kırmızı
PURPLE2   = (239, 68, 68)      # Açık kırmızı
WHITE     = (255, 255, 255)    # Beyaz

def draw_logo(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int):
    """Lingua L harfli soyut logo çizer."""
    lw = max(2, size // 12)   # çizgi kalınlığı
    pad = size // 5

    # Dış daire
    r = size // 2 - lw
    draw.ellipse([cx - r, cy - r, cx + r, cy + r],
                 outline=PURPLE2, width=lw)

    # İç ince daire
    r2 = r - lw * 2
    draw.ellipse([cx - r2, cy - r2, cx + r2, cy + r2],
                 outline=(*PURPLE2, 80), width=max(1, lw // 2))

    # Yatay çift ok  ⇄  (çeviri sembolü)
    arrow_y1 = cy - lw * 2
    arrow_y2 = cy + lw * 2
    ax1 = cx - r2 + lw * 2
    ax2 = cx + r2 - lw * 2
    aw = lw * 3  # ok başı boyutu

    # Üst ok  →
    draw.line([ax1, arrow_y1, ax2, arrow_y1], fill=WHITE, width=lw)
    draw.polygon([
        (ax2, arrow_y1),
        (ax2 - aw, arrow_y1 - aw // 2),
        (ax2 - aw, arrow_y1 + aw // 2),
    ], fill=WHITE)

    # Alt ok  ←
    draw.line([ax1, arrow_y2, ax2, arrow_y2], fill=WHITE, width=lw)
    draw.polygon([
        (ax1, arrow_y2),
        (ax1 + aw, arrow_y2 - aw // 2),
        (ax1 + aw, arrow_y2 + aw // 2),
    ], fill=WHITE)


def make_icon(size: int, path: str, rounded: bool = False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if rounded:
        radius = size // 5
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)
    else:
        draw.rectangle([0, 0, size - 1, size - 1], fill=BG)

    cx, cy = size // 2, size // 2
    logo_size = int(size * 0.55)
    draw_logo(draw, cx, cy, logo_size)

    img.save(path)
    print(f"  ✓ {os.path.basename(path)} ({size}x{size})")


def make_splash(width: int, height: int, path: str):
    img = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(img)

    cx, cy = width // 2, height // 2
    logo_size = min(width, height) // 3
    draw_logo(draw, cx, cy - 40, logo_size)

    # "LINGUA" yazısı
    font_size = max(24, width // 18)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except Exception:
        font = ImageFont.load_default()

    text = "LINGUA"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    tx = cx - tw // 2
    ty = cy + logo_size // 2 - 10

    draw.text((tx, ty), text, fill=WHITE, font=font)

    # Alt tagline
    tagline = "Universal Translator"
    small_size = max(14, font_size // 2)
    try:
        small_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", small_size)
    except Exception:
        small_font = ImageFont.load_default()

    tbbox = draw.textbbox((0, 0), tagline, font=small_font)
    tw2 = tbbox[2] - tbbox[0]
    draw.text((cx - tw2 // 2, ty + font_size + 8), tagline,
              fill=(*PURPLE2, 200), font=small_font)

    img.save(path)
    print(f"  ✓ {os.path.basename(path)} ({width}x{height})")


def make_adaptive_foreground(size: int, path: str):
    """Android adaptive icon foreground — şeffaf arka plan üzerinde logo."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = size // 2, size // 2
    logo_size = int(size * 0.5)
    draw_logo(draw, cx, cy, logo_size)
    img.save(path)
    print(f"  ✓ {os.path.basename(path)} ({size}x{size})")


if __name__ == "__main__":
    print("\nLingua — Asset Generator\n")

    print("App Icons:")
    make_icon(1024, f"{ASSETS_DIR}/icon.png", rounded=True)
    make_icon(1024, f"{ASSETS_DIR}/favicon.png")

    print("\nAndroid Adaptive Icon:")
    make_adaptive_foreground(1024, f"{ASSETS_DIR}/adaptive-icon.png")

    print("\nSplash Screens:")
    make_splash(1284, 2778, f"{ASSETS_DIR}/splash.png")

    print(f"""
✅ Tüm assetler {ASSETS_DIR}/ klasörüne oluşturuldu.

Şimdi APK build edebilirsin:
    cd LinguaApp
    npm install
    npx eas build -p android --profile preview
""")
