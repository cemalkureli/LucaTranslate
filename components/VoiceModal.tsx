import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
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
  partialText?: string;
  onStartPress: () => void;
  onStopPress: () => void;
  onClose: () => void;
  onSettingsPress?: () => void;
  onLangSelect?: (code: string) => void;
}

const BAR_COUNT = 24;

// Each bar is its own component so hooks are called at component level (not in a loop)
function WaveBar({ index, isRecording, isProcessing }: {
  index: number; isRecording: boolean; isProcessing: boolean;
}) {
  const height = useSharedValue(4);
  const center = BAR_COUNT / 2;
  const dist = Math.abs(index - center) / center;
  const targetH = 8 + ((index * 17 + 11) % 28); // deterministic, no Math.random

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
  }, [isRecording]);

  const barStyle = useAnimatedStyle(() => ({ height: height.value }));

  const color = isProcessing
    ? Colors.accent.cyan
    : isRecording
    ? `rgba(244,114,182,${(1 - dist * 0.45).toFixed(2)})`
    : Colors.bg.cardBorder;

  return (
    <Animated.View style={[styles.waveBar, barStyle, { backgroundColor: color }]} />
  );
}

// Engine indicator (reads AsyncStorage)
function EngineHint() {
  const [engine, setEngine] = React.useState('...');
  useEffect(() => {
    import('../hooks/useVoiceRecorder').then(({ getVoiceSettings }) => {
      getVoiceSettings().then(s => {
        const labels: Record<string, string> = {
          'web-speech': 'Web Speech API',
          'whisper-openai': 'OpenAI Whisper',
          'whisper-local': 'Local Whisper',
        };
        setEngine(labels[s.engine] || s.engine);
      });
    });
  }, []);
  return <Text style={styles.engineHint}>Motor: {engine}</Text>;
}

export default function VoiceModal({
  visible, state, sourceLang, partialText = '',
  onStartPress, onStopPress, onClose, onSettingsPress, onLangSelect,
}: VoiceModalProps) {
  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';


  const lang = LANGUAGES.find(l => l.code === sourceLang) || LANGUAGES[7];

  // Mic button scale
  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  // Glow ring pulse when recording
  const glow = useSharedValue(0);
  useEffect(() => {
    if (isRecording) {
      glow.value = withRepeat(withTiming(1, { duration: 950 }), -1, true);
    } else {
      cancelAnimation(glow);
      glow.value = withTiming(0, { duration: 280 });
    }
  }, [isRecording]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.22, 0.65]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.15]) }],
  }));

  const stateLabel = () => {
    if (state === 'recording') return 'Dinliyorum... 5 sn sessizlikte otomatik durur';
    if (state === 'processing') return 'Ses analiz ediliyor...';
    if (state === 'error') return 'Ses tanıma hatası.';
    if (sourceLang === 'auto') return 'Konuşma dilinizi seçin';
    return 'Mikrofona dokunun';
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={isRecording ? undefined : onClose}>
        <BlurView intensity={22} style={StyleSheet.absoluteFillObject} tint="dark" />
      </Pressable>

      <View style={styles.container} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header row */}
          <View style={styles.header}>
            <View style={styles.langBadge}>
              <Text style={styles.langFlag}>{lang.flag}</Text>
              <Text style={styles.langName}>{lang.nativeName}</Text>
              {sourceLang === 'auto' && <Text style={styles.autoTag}>auto</Text>}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              disabled={isRecording}
            >
              <CloseIcon size={14} color={isRecording ? Colors.text.muted : Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Auto mode: show full language picker, hide mic */}
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
              {/* Waveform visualizer */}
              <View style={styles.waveformOuter}>
                <View style={styles.waveform}>
                  {Array.from({ length: BAR_COUNT }, (_, i) => (
                    <WaveBar
                      key={i}
                      index={i}
                      isRecording={isRecording}
                      isProcessing={isProcessing}
                    />
                  ))}
                </View>
              </View>

              {/* Live transcript */}
              <View style={styles.transcriptBox}>
                {partialText ? (
                  <Text style={styles.partialText} numberOfLines={3}>"{partialText}"</Text>
                ) : isRecording ? (
                  <Text style={styles.listeningText}>🎙 Sizi dinliyorum...</Text>
                ) : isProcessing ? (
                  <Text style={styles.processingText}>⋯ İşleniyor...</Text>
                ) : (
                  <Text style={styles.idleText}>Ses girişi bekleniyor</Text>
                )}
              </View>

              {/* Big mic button */}
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
                      if (!isRecording && !isProcessing) onStartPress();
                      else if (isRecording) onStopPress();
                    }}
                    onPressIn={() => { btnScale.value = withSpring(0.88, { damping: 10 }); }}
                    onPressOut={() => { btnScale.value = withSpring(1, { damping: 10 }); }}
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

          {/* State text */}
          <Text style={[
            styles.stateLabel,
            isRecording && { color: '#F472B6' },
            isProcessing && { color: Colors.accent.cyan },
            state === 'error' && { color: '#F87171' },
          ]}>
            {stateLabel()}
          </Text>

          {state === 'error' && (
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => { onClose(); onSettingsPress?.(); }}
            >
              <Text style={styles.settingsBtnText}>⚙ Ses Tanıma Ayarları</Text>
            </TouchableOpacity>
          )}

          {state !== 'error' && (
            <Text style={styles.hint}>
              {isRecording ? '5 sn sessizlik sonrası otomatik kapanır' : `${lang.nativeName} dilinde konuşun`}
            </Text>
          )}

          <EngineHint />
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
  closeIcon: { color: Colors.text.secondary, fontSize: 14 },

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
    minHeight: 52, paddingHorizontal: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  partialText: {
    fontSize: 16, color: Colors.text.primary,
    textAlign: 'center', lineHeight: 24, fontStyle: 'italic',
  },
  listeningText: { fontSize: 14, color: '#F472B6', fontWeight: '600' },
  processingText: { fontSize: 14, color: Colors.accent.cyan, fontWeight: '600' },
  idleText: { fontSize: 13, color: Colors.text.muted },

  btnArea: {
    alignItems: 'center', justifyContent: 'center', height: 128,
  },
  glowRing: {
    position: 'absolute', width: 118, height: 118, borderRadius: 59,
  },
  micBtn: {
    width: 90, height: 90, borderRadius: 45, overflow: 'hidden',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 14,
  },
  micGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  micEmoji: { fontSize: 38 },

  stateLabel: {
    textAlign: 'center', fontSize: 14, color: Colors.text.muted,
    fontWeight: '500', marginTop: 10,
  },
  hint: {
    textAlign: 'center', fontSize: 12, color: Colors.text.muted,
    marginTop: 6, paddingHorizontal: 36, lineHeight: 18,
  },
  engineHint: {
    textAlign: 'center', fontSize: 11,
    color: Colors.text.muted + '70', marginTop: 8,
  },
  settingsBtn: {
    alignSelf: 'center', marginTop: 12,
    backgroundColor: Colors.accent.primary + '20',
    borderWidth: 1, borderColor: Colors.accent.primary + '60',
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8,
  },
  settingsBtnText: { color: Colors.accent.primary, fontWeight: '600', fontSize: 13 },

  // Auto lang picker
  autoLangPicker: {
    paddingHorizontal: 16, paddingBottom: 8, flex: 1,
  },
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
