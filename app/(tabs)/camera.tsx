import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';
import { LANGUAGES } from '../../constants/theme';
import { useTranslatorStore } from '../../store/translatorStore';
import { useOcrHistoryStore, OcrHistoryItem } from '../../store/ocrHistoryStore';
import { translate } from '../../services/translate';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CameraIcon, LanguageIcon, ScanIcon,
  BackIcon, TrashIcon, DownloadIcon, CloseIcon,
} from '../../components/Icons';

let MediaLibrary: any = null;
try { MediaLibrary = require('expo-media-library'); } catch {}

const OCR_KEY_STORAGE = 'lingua_ocr_api_key';
type State = 'idle' | 'ocr' | 'translating' | 'done' | 'viewing' | 'error';

async function getOcrApiKey(): Promise<string> {
  try {
    const key = await AsyncStorage.getItem(OCR_KEY_STORAGE);
    return key?.trim() || 'helloworld';
  } catch { return 'helloworld'; }
}

async function ocrFromBase64(base64: string): Promise<string> {
  const apiKey = await getOcrApiKey();
  const formData = new FormData();
  formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');

  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { apikey: apiKey },
    body: formData,
  });

  if (res.status === 429) throw new Error('OCR limit aşıldı. Ayarlar → OCR API Anahtarı.');
  if (!res.ok) throw new Error(`OCR hatası (${res.status}). Ayarlar → OCR API Anahtarı.`);

  const json = await res.json();
  if (json.IsErroredOnProcessing) {
    throw new Error(json.ErrorMessage?.[0] || 'OCR başarısız');
  }
  const text = json.ParsedResults?.[0]?.ParsedText?.trim();
  if (!text) throw new Error('Görselde metin bulunamadı.');
  return text;
}

export default function CameraScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [currentItem, setCurrentItem] = useState<OcrHistoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<OcrHistoryItem | null>(null);

  // Live scan
  const [liveScan, setLiveScan] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [liveTranslation, setLiveTranslation] = useState('');
  const [liveScanning, setLiveScanning] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const { targetLang, settings, setSourceText, performTranslation } = useTranslatorStore();
  const { items: history, addItem, removeItem } = useOcrHistoryStore();

  // ── Live scan auto-capture ──────────────────────────────────────────────────
  const runLiveCapture = useCallback(async () => {
    if (!cameraRef.current || liveScanning) return;
    setLiveScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.4, base64: false });
      if (!photo?.uri) return;
      const manip = await ImageManipulator.manipulateAsync(
        photo.uri, [{ resize: { width: 400 } }],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manip.base64) return;
      const text = await ocrFromBase64(manip.base64);
      setLiveText(text);
      const result = await translate(
        { q: text, source: 'auto', target: targetLang },
        { preferredInstance: settings.preferredInstance, apiKey: settings.apiKey },
      );
      setLiveTranslation(result.translatedText || '');
    } catch {
      // Silently ignore live scan errors
    } finally {
      setLiveScanning(false);
    }
  }, [liveScanning, targetLang, settings]);

  useEffect(() => {
    if (!liveScan) {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
      return;
    }
    runLiveCapture();
    liveTimerRef.current = setInterval(runLiveCapture, 3500);
    return () => { if (liveTimerRef.current) clearInterval(liveTimerRef.current); };
  }, [liveScan]);

  const startLiveScan = async () => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) { Alert.alert('İzin Gerekli', 'Canlı tarama için kamera izni gerekiyor.'); return; }
    }
    setLiveText('');
    setLiveTranslation('');
    setLiveScan(true);
  };

  const stopLiveScan = () => {
    setLiveScan(false);
    setLiveText('');
    setLiveTranslation('');
  };

  const sendLiveToTranslator = () => {
    if (!liveText) return;
    stopLiveScan();
    setSourceText(liveText);
    performTranslation();
    router.push('/');
  };

  // ── Photo capture ───────────────────────────────────────────────────────────
  const processPhoto = async (uri: string) => {
    try {
      setState('ocr');
      const manip = await ImageManipulator.manipulateAsync(
        uri, [{ resize: { width: 600 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
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
      Alert.alert('Hata', err.message || 'İşlem başarısız.');
    }
  };

  const handleOpenCamera = async () => {
    if (state !== 'idle') return;
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('İzin Gerekli', 'Kamera izni gerekiyor.'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (!result.canceled && result.assets?.[0]?.uri) await processPhoto(result.assets[0].uri);
    } catch (err: any) { Alert.alert('Kamera Hatası', err?.message || 'Kamera açılamadı'); }
  };

  const handleOpenGallery = async () => {
    if (state !== 'idle') return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert('İzin Gerekli', 'Galeri izni gerekiyor.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (!result.canceled && result.assets?.[0]?.uri) await processPhoto(result.assets[0].uri);
    } catch (err: any) { Alert.alert('Galeri Hatası', err?.message || 'Galeri açılamadı'); }
  };

  const handleGoToTranslator = (item: OcrHistoryItem) => {
    setSourceText(item.originalText);
    performTranslation();
    router.push('/');
  };

  const handleSave = async (item: OcrHistoryItem) => {
    if (!MediaLibrary) { Alert.alert('Bilgi', 'Kaydet özelliği bir sonraki güncellemede aktif olacak.'); return; }
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('İzin Gerekli', 'Galeri izni gerekiyor.'); return; }
      await MediaLibrary.saveToLibraryAsync(item.imageUri);
      Alert.alert('Kaydedildi', 'Görsel galeriye kaydedildi.');
    } catch (err: any) { Alert.alert('Hata', err.message); }
  };

  const handleDeleteItem = (id: string) => { removeItem(id); setViewingItem(null); setState('idle'); };
  const handleRetakeOrBack = () => { setCurrentItem(null); setViewingItem(null); setState('idle'); };

  const activeItem = state === 'viewing' ? viewingItem : currentItem;
  const showResult = (state === 'done' || state === 'viewing') && !!activeItem;
  const isProcessing = state === 'ocr' || state === 'translating';

  // ── Live Scan Screen ────────────────────────────────────────────────────────
  if (liveScan) {
    return (
      <View style={styles.liveContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />

        {/* Close button */}
        <SafeAreaView edges={['top']} style={styles.liveTop}>
          <TouchableOpacity style={styles.liveCloseBtn} onPress={stopLiveScan}>
            <CloseIcon size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.liveScanBadge}>
            {liveScanning
              ? <ActivityIndicator size="small" color={Colors.accent.cyan} />
              : <View style={styles.liveDot} />
            }
            <Text style={styles.liveBadgeText}>Canlı Tarama</Text>
          </View>
        </SafeAreaView>

        {/* Result overlay */}
        {(liveText || liveScanning) && (
          <View style={styles.liveOverlay}>
            <LinearGradient colors={['transparent', 'rgba(5,5,16,0.97)']} style={StyleSheet.absoluteFillObject} />
            {liveText ? (
              <>
                <Text style={styles.liveOriginal} numberOfLines={3}>{liveText}</Text>
                {liveTranslation ? (
                  <>
                    <View style={styles.liveDivider} />
                    <Text style={styles.liveTranslated} numberOfLines={3}>{liveTranslation}</Text>
                    <View style={styles.liveLangRow}>
                      <Text style={styles.liveLangBadge}>
                        {LANGUAGES.find(l => l.code === targetLang)?.flag ?? '🌐'} {LANGUAGES.find(l => l.code === targetLang)?.name}
                      </Text>
                    </View>
                  </>
                ) : null}
                <TouchableOpacity style={styles.liveSendBtn} onPress={sendLiveToTranslator}>
                  <LinearGradient colors={['#6C63FF', '#A78BFA']} style={styles.liveSendGrad}>
                    <LanguageIcon size={16} color="#fff" />
                    <Text style={styles.liveSendText}>Çevirici'ye Gönder</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.liveScanningText}>Metin aranıyor...</Text>
            )}
          </View>
        )}

        {/* Scan frame */}
        <View style={styles.liveScanFrame} pointerEvents="none">
          <View style={[styles.scanCorner, styles.scanCornerTL]} />
          <View style={[styles.scanCorner, styles.scanCornerTR]} />
          <View style={[styles.scanCorner, styles.scanCornerBL]} />
          <View style={[styles.scanCorner, styles.scanCornerBR]} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* History Strip */}
      {history.length > 0 && (
        <View style={styles.historyStrip}>
          <FlatList
            data={history} horizontal showsHorizontalScrollIndicator={false}
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
                    <Text style={styles.thumbBadgeText}>{LANGUAGES.find(l => l.code === item.targetLang)?.flag ?? '🌐'}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Idle / Processing */}
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
          ) : (
            <View style={styles.idleContent}>
              <View style={styles.scanDecor}>
                <View style={[styles.scanCorner, styles.scanCornerTL]} />
                <View style={[styles.scanCorner, styles.scanCornerTR]} />
                <View style={[styles.scanCorner, styles.scanCornerBL]} />
                <View style={[styles.scanCorner, styles.scanCornerBR]} />
                <CameraIcon size={52} color={Colors.accent.primary} strokeWidth={1.2} />
              </View>
              <Text style={styles.idleTitle}>Görsel Çeviri</Text>
              <Text style={styles.idleSubtitle}>
                Kameradan metin tara, galeriden seç veya canlı tarama modunu kullan
              </Text>
              <View style={styles.idleBtns}>
                {/* Canlı Tarama */}
                <TouchableOpacity style={styles.liveBtn} onPress={startLiveScan}>
                  <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.primaryBtnGrad}>
                    <View style={styles.liveDotSmall} />
                    <Text style={styles.primaryBtnText}>Canlı Tarama</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenCamera}>
                  <LinearGradient colors={['#6C63FF', '#A78BFA']} style={styles.primaryBtnGrad}>
                    <CameraIcon size={20} color="#fff" strokeWidth={2} />
                    <Text style={styles.primaryBtnText}>Fotoğraf Çek</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={handleOpenGallery}>
                  <ScanIcon size={18} color={Colors.text.secondary} />
                  <Text style={styles.secondaryBtnText}>Galeriden Seç</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Result View */}
      {showResult && (
        <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <Image source={{ uri: activeItem!.imageUri }} style={styles.resultImage} resizeMode="cover" />
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

      {/* Result Controls */}
      {showResult && (
        <View style={styles.resultControls}>
          <LinearGradient colors={['transparent', 'rgba(5,5,16,0.97)']} style={StyleSheet.absoluteFillObject} />
          <View style={styles.resultControlsRow}>
            <TouchableOpacity style={styles.smallBtn} onPress={handleRetakeOrBack}>
              <BackIcon size={20} color={Colors.text.secondary} />
              <Text style={styles.smallBtnLabel}>{state === 'viewing' ? 'Geri' : 'Yeniden'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.translateBtn} onPress={() => activeItem && handleGoToTranslator(activeItem)}>
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

const CORNER = 22;
const BORDER = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },

  // Live scan
  liveContainer: { flex: 1, backgroundColor: '#000' },
  liveTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  liveCloseBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  liveScanBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  liveDotSmall: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  liveScanFrame: {
    position: 'absolute', top: '25%', left: 24, right: 24, height: '45%',
  },
  liveOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: 36, gap: 8, overflow: 'hidden',
  },
  liveOriginal: { color: Colors.text.secondary, fontSize: 13, lineHeight: 19 },
  liveDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 2 },
  liveTranslated: { color: '#fff', fontSize: 17, fontWeight: '700', lineHeight: 24 },
  liveLangRow: { flexDirection: 'row' },
  liveLangBadge: { fontSize: 12, color: Colors.accent.secondary, fontWeight: '600' },
  liveSendBtn: { borderRadius: BorderRadius.full, overflow: 'hidden', marginTop: 8 },
  liveSendGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  liveSendText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  liveScanningText: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', marginBottom: 16 },

  // Scan corners
  scanCorner: { position: 'absolute', width: CORNER, height: CORNER },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER, borderColor: Colors.accent.primary, borderTopLeftRadius: 6 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER, borderColor: Colors.accent.primary, borderTopRightRadius: 6 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER, borderColor: Colors.accent.primary, borderBottomLeftRadius: 6 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER, borderColor: Colors.accent.primary, borderBottomRightRadius: 6 },

  // History
  historyStrip: { height: 88, borderBottomWidth: 1, borderBottomColor: Colors.bg.cardBorder, backgroundColor: Colors.bg.secondary },
  historyContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  thumb: { width: 68, height: 68, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: Colors.accent.primary },
  thumbImage: { width: '100%', height: '100%' },
  thumbBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 3, paddingVertical: 1 },
  thumbBadgeText: { fontSize: 12 },

  // Idle
  idleArea: { flex: 1, overflow: 'hidden' },
  processingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  processingText: { color: Colors.text.primary, fontSize: 17, fontWeight: '600' },
  idleContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  scanDecor: { width: 130, height: 130, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  idleTitle: { fontSize: 24, fontWeight: '700', color: Colors.text.primary },
  idleSubtitle: { fontSize: 13, color: Colors.text.muted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  idleBtns: { width: '100%', gap: 10, marginTop: 4 },
  liveBtn: { borderRadius: BorderRadius.full, overflow: 'hidden' },
  primaryBtn: { borderRadius: BorderRadius.full, overflow: 'hidden' },
  primaryBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 13, backgroundColor: Colors.bg.card, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.bg.cardBorder },
  secondaryBtnText: { color: Colors.text.secondary, fontWeight: '600', fontSize: 15 },

  // Result
  resultScroll: { flex: 1 },
  resultContent: { paddingBottom: 100 },
  resultImage: { width: '100%', height: 220, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  textCard: { margin: Spacing.base, marginTop: Spacing.md, padding: Spacing.base, backgroundColor: Colors.bg.card, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.bg.cardBorder, gap: 6 },
  textCardAccent: { borderColor: Colors.accent.primary + '40' },
  textCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textCardLabel: { fontSize: 11, color: Colors.text.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  textCardBody: { fontSize: 15, color: Colors.text.primary, lineHeight: 22 },
  langBadge: { fontSize: 13, color: Colors.accent.secondary, fontWeight: '600' },

  // Result controls
  resultControls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 24, paddingTop: 16, paddingHorizontal: Spacing.base, overflow: 'hidden' },
  resultControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallBtn: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: Colors.bg.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.bg.cardBorder },
  smallBtnLabel: { fontSize: 10, color: Colors.text.secondary, fontWeight: '600' },
  translateBtn: { flex: 1, borderRadius: BorderRadius.full, overflow: 'hidden' },
  translateBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  translateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
