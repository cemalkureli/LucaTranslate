# LucaTranslate

AI destekli mobil çeviri uygulaması. React Native + Expo ile geliştirilmiş, LibreTranslate ve OpenAI Whisper entegrasyonlu.

## Özellikler

- **Metin Çevirisi** — 40+ dil, otomatik dil algılama, MyMemory fallback
- **Sesli Giriş** — Google Web Speech API veya OpenAI Whisper; otomatik başlatma, 3 saniyelik sessizlik algılama, hata toleranslı yeniden deneme
- **Canlı Kamera Çevirisi** — Kamera görüntüsünden anlık metin tanıma ve çeviri; Latin, Çince, Japonca, Korece, Devanagari (Hindi) destekli çok-alfabe OCR
- **Görsel OCR** — Galeriden veya kameradan fotoğraf ile metin okuma ve çevirme
- **Çeviri Geçmişi** — Favorileme, silme, yeniden kullanma
- **Özel Sunucu** — Kendi LibreTranslate sunucunuza bağlanın
- **Dark UI** — Deep space teması, akıcı animasyonlar

## Tech Stack

| Paket | Açıklama |
|-------|----------|
| React Native 0.76 + Expo SDK 52 | Temel framework |
| expo-router 4 | Dosya tabanlı navigasyon |
| zustand 5 | State yönetimi |
| axios | HTTP istekleri |
| expo-av | Ses kaydı (Whisper için) |
| expo-image-picker | Kamera ve galeri erişimi |
| @react-native-voice/voice | Native Google ses tanıma |
| @react-native-ml-kit/text-recognition | Çok-alfabe on-device OCR |
| react-native-vision-camera | Canlı kamera akışı |
| expo-media-library | Galeriye kaydetme |
| react-native-reanimated | Animasyonlar |

## Kurulum

```bash
git clone https://github.com/cemalkureli/LucaTranslate.git
cd LucaTranslate
npm install
npx expo start
```

## APK Build (Local)

Android Studio kurulu olmalı.

```bash
# Görselleri yeniden oluştur (opsiyonel)
python generate_assets.py

# Release APK build
cd android
gradlew.bat assembleRelease --project-cache-dir C:\gradle-cache\translator --no-daemon
```

Çıktı: `android/app/build/outputs/apk/release/app-release.apk`

ADB ile telefona yükle:
```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## Ses Tanıma Motorları

| Motor | Açıklama | Gereksinim |
|-------|----------|------------|
| Web Speech API | Google yerleşik servis, 50+ dil | İnternet |
| OpenAI Whisper | En yüksek doğruluk, 100+ dil | OpenAI API anahtarı |

- Mikrofon butonu dili seçiliyken modalı açar ve kaydı otomatik başlatır
- 3 saniye sessizlik algılandığında kayıt otomatik durur ve çeviri tetiklenir
- Ayarlar: **Ayarlar → Ses Tanıma Ayarları**

## Canlı Kamera Çevirisi

Kamera ekranındaki **Canlı Çeviri** butonu ile kamerayı herhangi bir metne yöneltin. Uygulama 2.5 saniyede bir görüntüyü tarar; 5 farklı ML Kit modeli (Latin, Çince, Japonca, Korece, Devanagari) paralel çalışarak hangi alfabede olursa olsun metni tanır ve seçilen dile çevirir.

## Çeviri Sunucuları

Varsayılan: `https://libretranslate.com`

Kendi sunucunuzu bağlamak için:

```bash
# Docker ile yerel LibreTranslate
docker run -ti --rm -p 5000:5000 libretranslate/libretranslate
```

Uygulamada: **Ayarlar → Sunucular → Özel Sunucu → Bağlan & Aktif Et**

## Proje Yapısı

```
app/
  (tabs)/
    index.tsx         → Ana çeviri ekranı
    camera.tsx        → Görsel OCR + Canlı Çeviri ekranı
    settings-tab.tsx  → Ayarlar özeti
  history.tsx         → Geçmiş modal
  settings.tsx        → Sunucu + genel ayarlar
  voice-settings.tsx  → Ses tanıma ayarları

components/
  VoiceModal.tsx      → Kayıt arayüzü (dalga animasyonu, çeviri gösterimi)
  VoiceMicButton.tsx  → Inline ve büyük mikrofon butonları
  LanguageSelector.tsx
  Icons.tsx

store/
  translatorStore.ts  → Zustand store
  ocrHistoryStore.ts  → Kamera geçmişi (in-memory)

services/
  translate.ts        → LibreTranslate + MyMemory API

hooks/
  useVoiceRecorder.ts → Web Speech + OpenAI Whisper; hata toleranslı retry sistemi
```

## Lisans

[MIT](LICENSE) © 2025 cemalkureli
