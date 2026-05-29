import React, { useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import {
  ClockIcon, SwapIcon, CopyIcon, VolumeIcon, VolumeOffIcon,
  CloseIcon, ChevronDownIcon, ArrowRightIcon, SparkleIcon,
} from '../../components/Icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withRepeat, withSequence, interpolate, Extrapolation,
} from 'react-native-reanimated';

import { useTranslatorStore } from '../../store/translatorStore';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { LANGUAGES } from '../../constants/theme';
import LanguageSelector from '../../components/LanguageSelector';
import CharCounter from '../../components/CharCounter';
import { InlineMicButton } from '../../components/VoiceMicButton';
import VoiceModal from '../../components/VoiceModal';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { useState } from 'react';

const MAX_CHARS = 500;

function AnimatedOrb({ style }: { style: any }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.06);
  useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(1.3, { duration: 4000 }), withTiming(1, { duration: 4000 })), -1);
    opacity.value = withRepeat(withSequence(withTiming(0.12, { duration: 3500 }), withTiming(0.04, { duration: 3500 })), -1);
  }, []);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return <Animated.View style={[style, animStyle]} />;
}

export default function TranslatorScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [showLangPicker, setShowLangPicker] = useState<'source' | 'target' | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  const voice = useVoiceRecorder({
    onTranscript: (text) => {
      setSourceText(text);
      performTranslation();
      // Modal stays open so user sees transcript + translation
    },
    onError: (err) => console.warn('Voice error:', err),
  });

  const {
    sourceText, translatedText, sourceLang, targetLang,
    isTranslating, translationError, detectedLang,
    setSourceText, setSourceLang, setTargetLang,
    swapLanguages, performTranslation, clearTranslation, settings,
  } = useTranslatorStore();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!settings.autoTranslate) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { if (sourceText.trim()) performTranslation(); }, settings.autoTranslateDelay);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [sourceText, sourceLang, targetLang]);

  const swapRotation = useSharedValue(0);
  const resultOpacity = useSharedValue(0);
  const headerGlow = useSharedValue(0);

  useEffect(() => {
    resultOpacity.value = withTiming(translatedText ? 1 : 0, { duration: 300 });
  }, [translatedText]);

  useEffect(() => {
    headerGlow.value = withRepeat(withSequence(withTiming(1, { duration: 2500 }), withTiming(0, { duration: 2500 })), -1);
  }, []);

  const swapAnimStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${swapRotation.value}deg` }] }));
  const resultStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
    transform: [{ translateY: interpolate(resultOpacity.value, [0, 1], [10, 0], Extrapolation.CLAMP) }],
  }));
  const headerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(headerGlow.value, [0, 1], [0.4, 0.9]),
  }));

  const handleSwap = useCallback(() => {
    if (sourceLang === 'auto') return;
    swapRotation.value = withSpring(swapRotation.value + 180, { damping: 12 });
    swapLanguages();
  }, [sourceLang, swapLanguages]);

  const handleCopy = async (text: string) => { await Clipboard.setStringAsync(text); };
  const handleSpeak = async (text: string, lang: string) => {
    if (isSpeaking) { Speech.stop(); setIsSpeaking(false); return; }
    setIsSpeaking(true);
    await Speech.speak(text, { language: lang, onDone: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });
  };

  const sourceLangData = LANGUAGES.find(l => l.code === (detectedLang || sourceLang)) || LANGUAGES[7];
  const targetLangData = LANGUAGES.find(l => l.code === targetLang) || LANGUAGES[38];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#050510', '#0A0A1E', '#050510']} style={StyleSheet.absoluteFillObject} />

      {/* Animated orbs */}
      <AnimatedOrb style={styles.orb1} />
      <AnimatedOrb style={styles.orb2} />
      <AnimatedOrb style={styles.orb3} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Animated.Text style={[styles.appName, headerGlowStyle]}>LucaTranslate</Animated.Text>
            <Text style={styles.tagline}>AI-Powered Translation</Text>
          </View>
          <TouchableOpacity style={styles.historyBtn} onPress={() => router.push('/history')}>
            <ClockIcon size={20} color={Colors.accent.secondary} />
          </TouchableOpacity>
        </View>

        {/* Language Bar */}
        <View style={styles.langBar}>
          <TouchableOpacity style={styles.langChip} onPress={() => setShowLangPicker('source')} activeOpacity={0.7}>
            <Text style={styles.langFlag}>{LANGUAGES.find(l => l.code === sourceLang)?.flag || '🔍'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.langName}>
                {sourceLang === 'auto' ? 'Auto Detect' : LANGUAGES.find(l => l.code === sourceLang)?.nativeName || sourceLang}
              </Text>
              {detectedLang && sourceLang === 'auto' && (
                <Text style={styles.detectedLabel}>→ {LANGUAGES.find(l => l.code === detectedLang)?.name}</Text>
              )}
            </View>
            <ChevronDownIcon size={14} color={Colors.text.muted} />
          </TouchableOpacity>

          <Animated.View style={swapAnimStyle}>
            <TouchableOpacity
              style={[styles.swapBtn, sourceLang === 'auto' && styles.swapBtnDisabled]}
              onPress={handleSwap} activeOpacity={0.7}>
              <SwapIcon size={20} color={Colors.accent.primary} />
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={styles.langChip} onPress={() => setShowLangPicker('target')} activeOpacity={0.7}>
            <Text style={styles.langFlag}>{targetLangData.flag}</Text>
            <Text style={[styles.langName, { flex: 1 }]}>{targetLangData.nativeName}</Text>
            <ChevronDownIcon size={14} color={Colors.text.muted} />
          </TouchableOpacity>
        </View>

        {/* Source Input */}
        <View style={styles.card}>
          <LinearGradient colors={['#111128', '#0C0C20']}
            style={[StyleSheet.absoluteFillObject, { borderRadius: BorderRadius['2xl'] }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={styles.cardBorderGlow} />
          <View style={styles.cardInner}>
            <TextInput
              ref={inputRef}
              style={styles.sourceInput}
              placeholder="Type or speak to translate..."
              placeholderTextColor={Colors.text.muted}
              value={sourceText}
              onChangeText={(t) => setSourceText(t.slice(0, MAX_CHARS))}
              multiline textAlignVertical="top" autoCorrect={false}
            />
            <View style={styles.inputActions}>
              <CharCounter current={sourceText.length} max={MAX_CHARS} />
              <View style={styles.actionBtns}>
                {sourceText ? (
                  <>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleCopy(sourceText)}>
                      <CopyIcon size={16} color={Colors.text.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleSpeak(sourceText, sourceLang === 'auto' ? 'en' : sourceLang)}>
                      {isSpeaking ? <VolumeOffIcon size={16} color={Colors.text.secondary} /> : <VolumeIcon size={16} color={Colors.text.secondary} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.clearBtn} onPress={() => clearTranslation()}>
                      <CloseIcon size={16} color="#F4716B" />
                    </TouchableOpacity>
                  </>
                ) : null}
                <InlineMicButton state={voice.state} onPress={() => setShowVoiceModal(true)} />
              </View>
            </View>
          </View>
        </View>

        {/* Translate Button */}
        {!settings.autoTranslate && (
          <TouchableOpacity style={styles.translateBtn} onPress={() => performTranslation()} activeOpacity={0.85}>
            <LinearGradient colors={['#6C63FF', '#A78BFA', '#22D3EE']} style={styles.translateBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <ArrowRightIcon size={18} color="#fff" />
              <Text style={styles.translateBtnText}>Translate</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerPill}>
            {isTranslating ? <ActivityIndicator size="small" color={Colors.accent.primary} />
              : <SparkleIcon size={14} color={Colors.accent.secondary} />}
          </View>
          <View style={styles.dividerLine} />
        </View>

        {/* Result */}
        <Animated.View style={[styles.resultCard, resultStyle]}>
          <LinearGradient colors={['#12123A', '#0C0C28']} style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={styles.resultHeader}>
            <View style={styles.resultLangBadge}>
              <Text style={styles.resultLangFlag}>{targetLangData.flag}</Text>
              <Text style={styles.resultLangName}>{targetLangData.name}</Text>
            </View>
            {translatedText ? (
              <View style={styles.actionBtns}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleCopy(translatedText)}>
                  <CopyIcon size={16} color={Colors.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, isSpeaking && styles.actionBtnActive]}
                  onPress={() => handleSpeak(translatedText, targetLang)}>
                  {isSpeaking
                    ? <VolumeOffIcon size={16} color={Colors.accent.cyan} />
                    : <VolumeIcon size={16} color={Colors.text.secondary} />}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
          {translationError ? (
            <View style={styles.errorBox}><Text style={styles.errorText}>{translationError}</Text></View>
          ) : (
            <TouchableOpacity
              onPress={() => translatedText && handleSpeak(translatedText, targetLang)}
              activeOpacity={translatedText ? 0.7 : 1}
            >
              <Text style={[styles.resultText, { textAlign: ['ar', 'fa', 'he', 'ur'].includes(targetLang) ? 'right' : 'left' }]}>
                {isTranslating ? '' : (translatedText || (sourceText ? '...' : 'Translation will appear here'))}
              </Text>
              {translatedText && (
                <View style={styles.tapHint}>
                  <VolumeIcon size={11} color={Colors.text.muted} strokeWidth={2} />
                  <Text style={styles.tapHintText}>Seslendirmek için dokun</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Quick switch */}
        <View style={styles.quickLangs}>
          <Text style={styles.quickLangsLabel}>Quick Switch</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['en', 'de', 'fr', 'es', 'ja', 'zh', 'ar', 'ru', 'tr', 'pt'].map(code => {
              const lang = LANGUAGES.find(l => l.code === code);
              if (!lang) return null;
              const isActive = targetLang === code;
              return (
                <TouchableOpacity key={code}
                  style={[styles.quickChip, isActive && styles.quickChipActive]}
                  onPress={() => setTargetLang(code)}>
                  <Text style={styles.quickChipFlag}>{lang.flag}</Text>
                  <Text style={[styles.quickChipText, isActive && styles.quickChipTextActive]}>{lang.nativeName}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>

      {showLangPicker && (
        <LanguageSelector
          mode={showLangPicker}
          currentLang={showLangPicker === 'source' ? sourceLang : targetLang}
          onSelect={(code) => {
            if (showLangPicker === 'source') setSourceLang(code);
            else setTargetLang(code);
            setShowLangPicker(null);
          }}
          onClose={() => setShowLangPicker(null)}
          showAuto={showLangPicker === 'source'}
        />
      )}

      <VoiceModal
        visible={showVoiceModal}
        state={voice.state}
        sourceLang={sourceLang}
        targetLang={targetLang}
        partialText={voice.partialText}
        recognizedText={sourceText}
        translatedText={translatedText}
        onStartPress={() => voice.startListening(sourceLang === 'auto' ? '' : sourceLang)}
        onStopPress={() => voice.stopListening()}
        onClose={() => { voice.cancelListening(); setShowVoiceModal(false); }}
        onSettingsPress={() => router.push('/voice-settings')}
        onLangSelect={(code) => {
          setSourceLang(code);
          voice.startListening(code);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  orb1: {
    position: 'absolute', top: -100, right: -80, width: 320, height: 320,
    borderRadius: 160, backgroundColor: '#6C63FF',
  },
  orb2: {
    position: 'absolute', bottom: 150, left: -100, width: 280, height: 280,
    borderRadius: 140, backgroundColor: '#22D3EE',
  },
  orb3: {
    position: 'absolute', top: 350, right: -60, width: 200, height: 200,
    borderRadius: 100, backgroundColor: '#F472B6',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.base, paddingBottom: 120 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: Spacing.xl, paddingTop: Spacing.sm,
  },
  appName: {
    fontSize: 26, fontWeight: '900', color: '#fff',
    letterSpacing: 2,
    textShadowColor: Colors.accent.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  tagline: { fontSize: 11, color: Colors.accent.cyan, letterSpacing: 2, marginTop: 2, opacity: 0.8 },
  historyBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bg.card, borderWidth: 1,
    borderColor: Colors.accent.secondary + '40',
    justifyContent: 'center', alignItems: 'center',
  },

  langBar: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  langChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(17,17,36,0.9)', borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs,
  },
  langFlag: { fontSize: 22 },
  langName: { fontSize: 13, fontWeight: '600', color: Colors.text.primary },
  detectedLabel: { fontSize: 10, color: Colors.accent.cyan },
  swapBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.accent.primary + '20', borderWidth: 1,
    borderColor: Colors.accent.primary + '50', justifyContent: 'center', alignItems: 'center',
  },
  swapBtnDisabled: { opacity: 0.3 },

  card: {
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
    marginBottom: Spacing.sm, minHeight: 160,
  },
  cardBorderGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: Colors.accent.primary, opacity: 0.3,
  },
  cardInner: { flex: 1, padding: Spacing.base },
  sourceInput: {
    fontSize: 18, color: Colors.text.primary, lineHeight: 26,
    minHeight: 100, fontWeight: '400',
  },
  inputActions: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: Spacing.sm,
  },
  actionBtns: { flexDirection: 'row', gap: Spacing.xs },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bg.tertiary, justifyContent: 'center', alignItems: 'center',
  },
  clearBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F4716B20', justifyContent: 'center', alignItems: 'center',
  },

  translateBtn: { marginVertical: Spacing.sm, borderRadius: BorderRadius.full, overflow: 'hidden' },
  translateBtnGrad: {
    paddingVertical: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  translateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },

  divider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: Spacing.md, gap: Spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.bg.cardBorder },
  dividerPill: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bg.card, borderWidth: 1,
    borderColor: Colors.bg.cardBorder, justifyContent: 'center', alignItems: 'center',
  },

  resultCard: {
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1, borderColor: Colors.accent.primary + '40', minHeight: 140,
    overflow: 'hidden',
  },
  resultHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.base, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.bg.cardBorder,
  },
  resultLangBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  resultLangFlag: { fontSize: 18 },
  resultLangName: { fontSize: 13, fontWeight: '600', color: Colors.accent.secondary },
  resultText: {
    fontSize: 20, color: Colors.text.primary, lineHeight: 30,
    fontWeight: '400', padding: Spacing.base,
  },
  errorBox: { padding: Spacing.base },
  errorText: { color: '#F87171', fontSize: 14, lineHeight: 20 },
  translitText: {
    fontSize: 13, color: Colors.accent.cyan, paddingHorizontal: Spacing.base,
    paddingBottom: 4, fontStyle: 'italic', opacity: 0.8,
  },
  tapHint: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm,
  },
  tapHintText: { fontSize: 11, color: Colors.text.muted },
  actionBtnActive: { backgroundColor: Colors.accent.cyan + '25', borderColor: Colors.accent.cyan },

  quickLangs: { marginTop: Spacing.xl },
  quickLangsLabel: {
    fontSize: 11, color: Colors.text.muted, letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: Spacing.sm,
  },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
    paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
  },
  quickChipActive: { backgroundColor: Colors.accent.primary + '20', borderColor: Colors.accent.primary },
  quickChipFlag: { fontSize: 16 },
  quickChipText: { fontSize: 13, color: Colors.text.secondary, fontWeight: '500' },
  quickChipTextActive: { color: Colors.accent.primary },
});
