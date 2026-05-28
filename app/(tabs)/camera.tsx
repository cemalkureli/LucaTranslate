import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';
import { LANGUAGES } from '../../constants/theme';
import { useTranslatorStore } from '../../store/translatorStore';
import { useOcrHistoryStore, OcrHistoryItem } from '../../store/ocrHistoryStore';
import { translate } from '../../services/translate';
import {
  CameraIcon, LanguageIcon, ScanIcon,
  BackIcon, TrashIcon, DownloadIcon,
} from '../../components/Icons';

let MediaLibrary: any = null;
try { MediaLibrary = require('expo-media-library'); } catch {}

type State = 'idle' | 'ocr' | 'translating' | 'done' | 'viewing' | 'error';

async function ocrFromBase64(base64: string): Promise<string> {
  const formData = new FormData();
  formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
  formData.append('language', 'tur,eng,deu,fra,spa,jpn,chi_sim,ara,rus');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');

  const res = await fetch('https://api.ocr.space/parse/base64', {
    method: 'POST',
    headers: { apikey: 'helloworld' },
    body: formData,
  });
  if (!res.ok) throw new Error(`OCR sunucusu hatası (${res.status})`);
  const json = await res.json();
  if (json.IsErroredOnProcessing) {
    throw new Error(json.ErrorMessage?.[0] || 'OCR başarısız');
  }
  const text = json.ParsedResults?.[0]?.ParsedText?.trim();
  if (!text) throw new Error('Görselde okunabilir metin bulunamadı');
  return text;
}

export default function CameraScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentItem, setCurrentItem] = useState<OcrHistoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<OcrHistoryItem | null>(null);

  const { targetLang, settings, setSourceText, performTranslation } = useTranslatorStore();
  const { items: history, addItem, removeItem } = useOcrHistoryStore();

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setState('error');
    setTimeout(() => setState('idle'), 3500);
  };

  const processPhoto = async (uri: string) => {
    try {
      setState('ocr');
      const manip = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1000 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manip.base64) throw new Error('Görsel işlenemedi');

      const originalText = await ocrFromBase64(manip.base64);

      setState('translating');
      const result = await translate(
        { q: originalText, source: 'auto', target: targetLang },
        { preferredInstance: settings.preferredInstance, apiKey: settings.apiKey },
      );

      const item = addItem({
        imageUri: manip.uri,
        originalText,
        translatedText: result.translatedText || originalText,
        targetLang,
      });
      setCurrentItem(item);
      setState('done');
    } catch (err: any) {
      setState('idle');
      Alert.alert('Hata', err.message || 'İşlem başarısız oldu. Lütfen tekrar deneyin.');
    }
  };

  const handleOpenCamera = async () => {
    if (state !== 'idle') return;
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          'Kamera İzni Gerekli',
          'Ayarlar > Uygulamalar > LucaTranslate > İzinler > Kamera',
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images' as const],
        quality: 0.85,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        await processPhoto(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Kamera Hatası', err?.message || 'Kamera açılamadı');
    }
  };

  const handleOpenGallery = async () => {
    if (state !== 'idle') return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Galeri erişimi için izin verin.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images' as const],
        quality: 0.85,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        await processPhoto(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Galeri Hatası', err?.message || 'Galeri açılamadı');
    }
  };

  const handleGoToTranslator = (item: OcrHistoryItem) => {
    setSourceText(item.originalText);
    performTranslation();
    router.push('/');
  };

  const handleSave = async (item: OcrHistoryItem) => {
    if (!MediaLibrary) {
      Alert.alert('Bilgi', 'Kaydet özelliği bir sonraki APK güncellemesinde aktif olacak.');
      return;
    }
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('İzin Gerekli', 'Galeriye kaydetmek için izin verin.'); return; }
      await MediaLibrary.saveToLibraryAsync(item.imageUri);
      Alert.alert('Kaydedildi', 'Görsel galeriye kaydedildi.');
    } catch (err: any) { Alert.alert('Hata', err.message); }
  };

  const handleRetakeOrBack = () => {
    setCurrentItem(null);
    setViewingItem(null);
    setState('idle');
  };

  const handleDeleteItem = (id: string) => {
    removeItem(id);
    setViewingItem(null);
    setState('idle');
  };

  const activeItem = state === 'viewing' ? viewingItem : currentItem;
  const showResult = (state === 'done' || state === 'viewing') && !!activeItem;
  const isProcessing = state === 'ocr' || state === 'translating';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── History Thumbnail Strip ─────────────────────── */}
      {history.length > 0 && (
        <View style={styles.historyStrip}>
          <FlatList
            data={history}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.historyContent}
            renderItem={({ item }) => {
              const isActive = activeItem?.id === item.id;
              return (
                <TouchableOpacity
                  onPress={() => { setViewingItem(item); setState('viewing'); }}
                  style={[styles.thumb, isActive && styles.thumbActive]}
                >
                  <Image source={{ uri: item.imageUri }} style={styles.thumbImage} />
                  <View style={styles.thumbBadge}>
                    <Text style={styles.thumbBadgeText}>
                      {LANGUAGES.find(l => l.code === item.targetLang)?.flag ?? '🌐'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* ── Idle / Processing ────────────────────────────── */}
      {!showResult && (
        <View style={styles.idleArea}>
          <LinearGradient colors={['#050510', '#0A0A1E']} style={StyleSheet.absoluteFillObject} />

          {isProcessing ? (
            <View style={styles.processingBox}>
              <ActivityIndicator size="large" color={Colors.accent.primary} />
              <Text style={styles.processingText}>
                {state === 'ocr' ? 'Metin okunuyor...' : 'Çevriliyor...'}
              </Text>
            </View>
          ) : state === 'error' ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity style={styles.retrySmall} onPress={() => setState('idle')}>
                <Text style={styles.retrySmallText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.idleContent}>
              {/* Scan frame decoration */}
              <View style={styles.scanDecor}>
                <View style={styles.scanCornerTL} />
                <View style={styles.scanCornerTR} />
                <View style={styles.scanCornerBL} />
                <View style={styles.scanCornerBR} />
                <CameraIcon size={56} color={Colors.accent.primary} strokeWidth={1.2} />
              </View>
              <Text style={styles.idleTitle}>Görsel Çeviri</Text>
              <Text style={styles.idleSubtitle}>
                Fotoğraf çek veya galerinden seç — metni otomatik tespit edip çeviririz
              </Text>

              <View style={styles.idleBtns}>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenCamera}>
                  <LinearGradient colors={['#6C63FF', '#A78BFA']} style={styles.primaryBtnGrad}>
                    <CameraIcon size={22} color="#fff" strokeWidth={2} />
                    <Text style={styles.primaryBtnText}>Kamera Aç</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={handleOpenGallery}>
                  <ScanIcon size={20} color={Colors.text.secondary} />
                  <Text style={styles.secondaryBtnText}>Galeriden Seç</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Result View ──────────────────────────────────── */}
      {showResult && (
        <ScrollView
          style={styles.resultScroll}
          contentContainerStyle={styles.resultContent}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={{ uri: activeItem!.imageUri }}
            style={styles.resultImage}
            resizeMode="cover"
          />
          <View style={styles.textCard}>
            <Text style={styles.textCardLabel}>Tespit Edilen Metin</Text>
            <Text style={styles.textCardBody}>{activeItem!.originalText}</Text>
          </View>
          <View style={[styles.textCard, styles.textCardAccent]}>
            <View style={styles.textCardRow}>
              <Text style={styles.textCardLabel}>Çeviri</Text>
              <Text style={styles.langBadge}>
                {LANGUAGES.find(l => l.code === activeItem!.targetLang)?.flag ?? '🌐'}{' '}
                {LANGUAGES.find(l => l.code === activeItem!.targetLang)?.name ?? activeItem!.targetLang}
              </Text>
            </View>
            <Text style={styles.textCardBody}>{activeItem!.translatedText}</Text>
          </View>
        </ScrollView>
      )}

      {/* ── Bottom Controls (result mode) ────────────────── */}
      {showResult && (
        <View style={styles.resultControls}>
          <LinearGradient
            colors={['transparent', 'rgba(5,5,16,0.97)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.resultControlsRow}>
            <TouchableOpacity style={styles.smallBtn} onPress={handleRetakeOrBack}>
              <BackIcon size={20} color={Colors.text.secondary} />
              <Text style={styles.smallBtnLabel}>{state === 'viewing' ? 'Geri' : 'Yeniden'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.translateBtn}
              onPress={() => activeItem && handleGoToTranslator(activeItem)}
            >
              <LinearGradient colors={['#6C63FF', '#A78BFA']} style={styles.translateBtnGrad}>
                <LanguageIcon size={18} color="#fff" />
                <Text style={styles.translateBtnText}>Çevirici'ye Gönder</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.smallBtn} onPress={() => activeItem && handleSave(activeItem)}>
              <DownloadIcon size={20} color={Colors.accent.cyan} />
              <Text style={[styles.smallBtnLabel, { color: Colors.accent.cyan }]}>Kaydet</Text>
            </TouchableOpacity>

            {state === 'viewing' && viewingItem && (
              <TouchableOpacity style={styles.smallBtn} onPress={() => handleDeleteItem(viewingItem.id)}>
                <TrashIcon size={20} color={Colors.accent.pink} />
                <Text style={[styles.smallBtnLabel, { color: Colors.accent.pink }]}>Sil</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const CORNER = 20;
const BORDER = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },

  // History strip
  historyStrip: {
    height: 88, borderBottomWidth: 1,
    borderBottomColor: Colors.bg.cardBorder, backgroundColor: Colors.bg.secondary,
  },
  historyContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  thumb: {
    width: 68, height: 68, borderRadius: 12, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
  },
  thumbActive: { borderColor: Colors.accent.primary },
  thumbImage: { width: '100%', height: '100%' },
  thumbBadge: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8,
    paddingHorizontal: 3, paddingVertical: 1,
  },
  thumbBadgeText: { fontSize: 12 },

  // Idle / processing area
  idleArea: { flex: 1, overflow: 'hidden' },
  processingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  processingText: { color: Colors.text.primary, fontSize: 17, fontWeight: '600' },
  errorBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 32 },
  errorEmoji: { fontSize: 48 },
  errorText: { color: Colors.accent.pink, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retrySmall: {
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  retrySmallText: { color: Colors.text.secondary, fontWeight: '600' },

  idleContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 20 },
  scanDecor: {
    width: 140, height: 140, justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  scanCornerTL: {
    position: 'absolute', top: 0, left: 0, width: CORNER, height: CORNER,
    borderTopWidth: BORDER, borderLeftWidth: BORDER,
    borderColor: Colors.accent.primary, borderTopLeftRadius: 6,
  },
  scanCornerTR: {
    position: 'absolute', top: 0, right: 0, width: CORNER, height: CORNER,
    borderTopWidth: BORDER, borderRightWidth: BORDER,
    borderColor: Colors.accent.primary, borderTopRightRadius: 6,
  },
  scanCornerBL: {
    position: 'absolute', bottom: 0, left: 0, width: CORNER, height: CORNER,
    borderBottomWidth: BORDER, borderLeftWidth: BORDER,
    borderColor: Colors.accent.primary, borderBottomLeftRadius: 6,
  },
  scanCornerBR: {
    position: 'absolute', bottom: 0, right: 0, width: CORNER, height: CORNER,
    borderBottomWidth: BORDER, borderRightWidth: BORDER,
    borderColor: Colors.accent.primary, borderBottomRightRadius: 6,
  },
  idleTitle: { fontSize: 24, fontWeight: '700', color: Colors.text.primary },
  idleSubtitle: {
    fontSize: 14, color: Colors.text.muted, textAlign: 'center',
    lineHeight: 21, maxWidth: 280,
  },
  idleBtns: { width: '100%', gap: 12, marginTop: 8 },
  primaryBtn: { borderRadius: BorderRadius.full, overflow: 'hidden' },
  primaryBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14,
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
  },
  secondaryBtnText: { color: Colors.text.secondary, fontWeight: '600', fontSize: 15 },

  // Result
  resultScroll: { flex: 1 },
  resultContent: { paddingBottom: 100 },
  resultImage: { width: '100%', height: 220, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  textCard: {
    margin: Spacing.base, marginTop: Spacing.md, padding: Spacing.base,
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.bg.cardBorder, gap: 6,
  },
  textCardAccent: { borderColor: Colors.accent.primary + '40' },
  textCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textCardLabel: {
    fontSize: 11, color: Colors.text.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  textCardBody: { fontSize: 15, color: Colors.text.primary, lineHeight: 22 },
  langBadge: { fontSize: 13, color: Colors.accent.secondary, fontWeight: '600' },

  // Result controls
  resultControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 24, paddingTop: 16, paddingHorizontal: Spacing.base,
    overflow: 'hidden',
  },
  resultControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, paddingHorizontal: 10,
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
  },
  smallBtnLabel: { fontSize: 10, color: Colors.text.secondary, fontWeight: '600' },
  translateBtn: { flex: 1, borderRadius: BorderRadius.full, overflow: 'hidden' },
  translateBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
  },
  translateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
