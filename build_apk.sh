#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Lingua — APK Build Script
#  Bu script'i LinguaApp klasöründe çalıştır:
#    chmod +x build_apk.sh && ./build_apk.sh
# ═══════════════════════════════════════════════════════════

set -e

PURPLE='\033[0;35m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${PURPLE}╔══════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║     Lingua APK Build Script          ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════╝${NC}"
echo ""

# ── 1. Node.js kontrolü ──────────────────────────────────
echo -e "${YELLOW}[1/6] Node.js kontrol ediliyor...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js bulunamadı!${NC}"
    echo "  Yükle: https://nodejs.org (LTS versiyonu)"
    exit 1
fi
NODE_VER=$(node -v)
echo -e "${GREEN}  ✓ Node.js $NODE_VER${NC}"

# ── 2. EAS CLI kontrolü ──────────────────────────────────
echo -e "${YELLOW}[2/6] EAS CLI kontrol ediliyor...${NC}"
if ! command -v eas &> /dev/null; then
    echo "  EAS CLI bulunamadı. Yükleniyor..."
    npm install -g eas-cli
fi
EAS_VER=$(eas --version 2>/dev/null || echo "?")
echo -e "${GREEN}  ✓ EAS CLI $EAS_VER${NC}"

# ── 3. Asset'leri oluştur ────────────────────────────────
echo -e "${YELLOW}[3/6] Asset'ler kontrol ediliyor...${NC}"
if [ ! -f "assets/icon.png" ]; then
    echo "  assets/icon.png bulunamadı. Oluşturuluyor..."
    if command -v python3 &> /dev/null; then
        python3 generate_assets.py
    else
        echo -e "${RED}  ✗ Python3 bulunamadı. Asset'leri manuel ekle:${NC}"
        echo "    assets/icon.png       (1024x1024)"
        echo "    assets/splash.png     (1284x2778)"
        echo "    assets/adaptive-icon.png (1024x1024, şeffaf bg)"
        exit 1
    fi
else
    echo -e "${GREEN}  ✓ Asset'ler mevcut${NC}"
fi

# ── 4. npm install ───────────────────────────────────────
echo -e "${YELLOW}[4/6] Bağımlılıklar yükleniyor...${NC}"
npm install
echo -e "${GREEN}  ✓ npm install tamamlandı${NC}"

# ── 5. Expo hesabı giriş ─────────────────────────────────
echo -e "${YELLOW}[5/6] Expo hesabı kontrol ediliyor...${NC}"
echo ""
echo -e "  ${YELLOW}Expo hesabın yoksa:${NC} https://expo.dev/signup (ücretsiz)"
echo -e "  Hesabın varsa aşağıda giriş yap:"
echo ""
eas whoami 2>/dev/null || eas login

# ── 6. APK Build ─────────────────────────────────────────
echo ""
echo -e "${YELLOW}[6/6] APK build başlatılıyor...${NC}"
echo ""
echo -e "${PURPLE}  Build türü seç:${NC}"
echo "  1) preview  → APK (direkt yüklenebilir, önerilen)"
echo "  2) production → APK (yayın için optimize)"
echo ""
read -p "  Seçim (1/2) [varsayılan: 1]: " choice
choice=${choice:-1}

if [ "$choice" = "2" ]; then
    PROFILE="production"
else
    PROFILE="preview"
fi

echo ""
echo -e "${GREEN}  → eas build -p android --profile $PROFILE başlatılıyor...${NC}"
echo ""
echo -e "${YELLOW}  NOT: Build Expo'nun bulut sunucularında çalışır (~5-15 dk).${NC}"
echo -e "${YELLOW}  Bitince APK linkini terminalde göreceksin.${NC}"
echo ""

eas build -p android --profile $PROFILE

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Build tamamlandı!                 ║${NC}"
echo -e "${GREEN}║  APK'yı yukarıdaki linkten indir.    ║${NC}"
echo -e "${GREEN}║  Telefona USB ile at veya QR tara.   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
