import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence,
  withSpring, interpolate, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { VoiceState } from '../hooks/useVoiceRecorder';
import { Colors, BorderRadius, LANGUAGES } from '../constants/theme';
import { MicIcon, StopIcon, CloseIcon } from './Icons';

interface VoiceModalProps {
  visible: boolean;
  state: VoiceState;
  sourceLang: string;
  targetLang?: string;
  partialText?: string;
  recognizedText?: string;
  translatedText?: string;
  onStartPress: () => void;
  onStopPress: () => void;
  onClose: () => void;
  onSettingsPress?: () => void;
  onLangSelect?: (code: string) => void;
}

const BAR_COUNT = 24;

function WaveBar({ index, isRecording, isProcessing }: {
  index: number; isRecording: boolean; isProcessing: boolean;
}) {
  const height = useSharedValue(4);
  const targetH = 8 + ((index * 17 + 11) % 28);

  useEffect(() => {
    if (isRecording) {
      const dur = 260 + (index % 8) * 70;
      height.value = withRepeat(
        withTiming(targetH, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        -1, true
      );
    } else {
      cancelAnimation(height);
      height.value = withTiming(4, { duration: 220 });
    }
    return () => { cancelAnimation(height); };
  }, [isRecording]);

  const barStyle = useAnimatedStyle(() => ({ height: height.value }));
  const center = BAR_COUNT / 2;
  const dist = Math.abs(index - center) / center;
  const color = isProcessing
    ? Colors.accent.cyan
    : isRecording
    ? `rgba(244,114,182,${(1 - dist * 0.45).toFixed(2)})`
    : Colors.bg.cardBorder;

  return <Animated.View style={[styles.waveBar, barStyle, { backgroundColor: color }]} />;
}

export default function VoiceModal({
  visible, state, sourceLang, targetLang = 'en',
  partialText = '', recognizedText = '', translatedText = '',
  onStartPress, onStopPress, onClose, onSettingsPress, onLangSelect,
}: VoiceModalProps) {
  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const sourceLangData = LANGUAGES.find(l => l.code === sourceLang) || LANGUAGES[7];
  const targetLangData = LANGUAGES.find(l => l.code === targetLang);

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const glow = useSharedValue(0);
  useEffect(() => {
    if (isRecording) {
      glow.value = withRepeat(withTiming(1, { duration: 950 }), -1, true);
    } else {
      cancelAnimation(glow);
      glow.value = withTiming(0, { duration: 280 });
    }
    return () => { cancelAnimation(glow); };
  }, [isRecording]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.22, 0.65]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.15]) }],
  }));

  const displayText = isRecording || isProcessing ? partialText : (recognizedText || partialText);
  const showTranslation = !!translatedText && !isRecording && !isProcessing;

  const stateLabel =
    state === 'recording' ? 'Dinliyorum...' :
    state === 'processing' ? 'Analiz ediliyor...' :
    state === 'error' ? 'Ses tanıma hatası.' :
    sourceLang === 'auto' ? 'Konuşma dilinizi seçin' :
    showTranslation ? 'Tekrar konuşmak için mikrofona dokunun' :
    'Mikrofona dokunun';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={22} style={StyleSheet.absoluteFillObject} tint="dark" />
      </Pressable>

      <View style={styles.container} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.langBadge}>
              <Text style={styles.langFlag}>{sourceLangData.flag}</Text>
              <Text style={styles.langName}>{sourceLangData.nativeName}</Text>
              {sourceLang === 'auto' && <Text style={styles.autoTag}>auto</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <CloseIcon size={14} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Auto mode: language picker */}
          {sourceLang === 'auto' && !isRecording && !isProcessing ? (
            <View style={styles.autoLangPicker}>
              <Text style={styles.autoLangTitle}>Konuşma dilinizi seçin</Text>
              <ScrollView
                style={styles.langScroll}
                contentContainerStyle={styles.langScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {LANGUAGES.filter(l => l.code !== 'auto').map(l => (
                  <TouchableOpacity
                    key={l.code}
                    style={styles.langChip}
                    onPress={() => onLangSelect?.(l.code)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.langChipFlag}>{l.flag}</Text>
                    <Text style={styles.langChipName}>{l.nativeName}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <>
              {/* Waveform */}
              <View style={styles.waveformOuter}>
                <View style={styles.waveform}>
                  {Array.from({ length: BAR_COUNT }, (_, i) => (
                    <WaveBar key={i} index={i} isRecording={isRecording} isProcessing={isProcessing} />
                  ))}
                </View>
              </View>

              {/* Transcript */}
              <View style={styles.transcriptBox}>
                {displayText ? (
                  <Text style={styles.partialText} numberOfLines={3}>{displayText}</Text>
                ) : isRecording ? (
                  <Text style={styles.listeningText}>🎙 Sizi dinliyorum...</Text>
                ) : isProcessing ? (
                  <Text style={styles.processingText}>⋯ İşleniyor...</Text>
                ) : (
                  <Text style={styles.idleText}>Ses girişi bekleniyor</Text>
                )}
              </View>

              {/* Translation result — shown after recording stops */}
              {showTranslation && (
                <View style={styles.translationBox}>
                  {targetLangData && (
                    <View style={styles.translationHeader}>
                      <Text style={styles.translationFlag}>{targetLangData.flag}</Text>
                      <Text style={styles.translationLang}>{targetLangData.nativeName}</Text>
                    </View>
                  )}
                  <Text style={styles.translationText}>{translatedText}</Text>
                </View>
              )}

              {/* Mic button */}
              <View style={styles.btnArea}>
                {(isRecording || isProcessing) && (
                  <Animated.View style={[
                    styles.glowRing,
                    glowStyle,
                    { backgroundColor: isProcessing ? Colors.accent.cyan : '#F472B6' },
                  ]} />
                )}
                <Animated.View style={btnStyle}>
                  <Pressable
                    onPress={() => {
                      btnScale.value = withSequence(
                        withSpring(0.85, { damping: 15 }),
                        withSpring(1, { damping: 10 })
                      );
                      if (!isRecording && !isProcessing) onStartPress();
                      else if (isRecording) onStopPress();
                    }}
                    style={styles.micBtn}
                  >
                    <LinearGradient
                      colors={
                        isProcessing ? [Colors.accent.cyan, '#0891B2']
                        : isRecording ? ['#F472B6', '#BE185D']
                        : [Colors.accent.primary, Colors.accent.secondary]
                      }
                      style={styles.micGrad}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    >
                      {isProcessing
                        ? <Text style={{ fontSize: 32, color: '#fff' }}>⋯</Text>
                        : isRecording
                        ? <StopIcon size={38} color="#fff" />
                        : <MicIcon size={38} color="#fff" strokeWidth={1.8} />
                      }
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              </View>
            </>
          )}

          {/* State label */}
          <Text style={[
            styles.stateLabel,
            isRecording && { color: '#F472B6' },
            isProcessing && { color: Colors.accent.cyan },
            state === 'error' && { color: '#F87171' },
          ]}>
            {stateLabel}
          </Text>

          {state === 'error' && (
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => { onClose(); onSettingsPress?.(); }}
            >
              <Text style={styles.settingsBtnText}>⚙ Ses Tanıma Ayarları</Text>
            </TouchableOpacity>
          )}

          {isRecording && (
            <Text style={styles.hint}>3 sn sessizlik → otomatik durur</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  container: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingBottom: 48,
    borderTopWidth: 1, borderColor: Colors.bg.cardBorder,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.bg.cardBorder,
    alignSelf: 'center', marginTop: 14, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
  },
  langBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.full,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
  },
  langFlag: { fontSize: 20 },
  langName: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  autoTag: {
    fontSize: 10, color: Colors.accent.cyan,
    backgroundColor: Colors.accent.cyan + '20',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bg.card, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
  },

  waveformOuter: {
    height: 68, justifyContent: 'center',
    paddingHorizontal: 16, marginVertical: 6,
  },
  waveform: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 3.5,
  },
  waveBar: { width: 3.5, borderRadius: 3, minHeight: 4 },

  transcriptBox: {
    minHeight: 48, paddingHorizontal: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  partialText: {
    fontSize: 16, color: Colors.text.primary,
    textAlign: 'center', lineHeight: 24,
  },
  listeningText: { fontSize: 14, color: '#F472B6', fontWeight: '600' },
  processingText: { fontSize: 14, color: Colors.accent.cyan, fontWeight: '600' },
  idleText: { fontSize: 13, color: Colors.text.muted },

  translationBox: {
    marginHorizontal: 20, marginBottom: 8,
    padding: 14, backgroundColor: Colors.accent.primary + '12',
    borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.accent.primary + '30',
    gap: 6,
  },
  translationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  translationFlag: { fontSize: 15 },
  translationLang: { fontSize: 11, color: Colors.accent.secondary, fontWeight: '600' },
  translationText: {
    fontSize: 18, color: Colors.text.primary, lineHeight: 26, fontWeight: '400',
  },

  btnArea: {
    alignItems: 'center', justifyContent: 'center', height: 120,
  },
  glowRing: {
    position: 'absolute', width: 118, height: 118, borderRadius: 59,
  },
  micBtn: {
    width: 88, height: 88, borderRadius: 44, overflow: 'hidden',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 14,
  },
  micGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  stateLabel: {
    textAlign: 'center', fontSize: 13, color: Colors.text.muted,
    fontWeight: '500', marginTop: 8,
  },
  hint: {
    textAlign: 'center', fontSize: 11, color: Colors.text.muted,
    marginTop: 4, paddingHorizontal: 36,
  },
  settingsBtn: {
    alignSelf: 'center', marginTop: 12,
    backgroundColor: Colors.accent.primary + '20',
    borderWidth: 1, borderColor: Colors.accent.primary + '60',
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8,
  },
  settingsBtnText: { color: Colors.accent.primary, fontWeight: '600', fontSize: 13 },

  autoLangPicker: { paddingHorizontal: 16, paddingBottom: 8 },
  autoLangTitle: {
    fontSize: 13, color: Colors.text.muted, textAlign: 'center',
    marginBottom: 10, fontWeight: '600',
  },
  langScroll: { maxHeight: 220 },
  langScrollContent: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
  },
  langChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.bg.card, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  langChipFlag: { fontSize: 15 },
  langChipName: { fontSize: 12, color: Colors.text.primary, fontWeight: '500' },
});
