import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, BorderRadius } from '../constants/theme';

const VOICE_SETTINGS_KEY = 'lingua_voice_settings';

interface VoiceSettings {
  engine: 'whisper-openai' | 'web-speech';
  openaiApiKey: string;
}

const DEFAULT: VoiceSettings = { engine: 'web-speech', openaiApiKey: '' };

export default function VoiceSettingsScreen() {
  const router = useRouter();
  const [saved, setSaved] = useState<VoiceSettings>(DEFAULT);
  const [draft, setDraft] = useState<VoiceSettings>(DEFAULT);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(VOICE_SETTINGS_KEY).then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw);
        const loaded: VoiceSettings = {
          engine: parsed.engine === 'whisper-openai' ? 'whisper-openai' : 'web-speech',
          openaiApiKey: parsed.openaiApiKey || '',
        };
        setSaved(loaded);
        setDraft(loaded);
      }
    });
  }, []);

  const handleSave = async () => {
    await AsyncStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(draft));
    setSaved(draft);
    setSaveSuccess(true);
    setTimeout(() => { setSaveSuccess(false); router.back(); }, 800);
  };

  const isDirty = draft.engine !== saved.engine || draft.openaiApiKey !== saved.openaiApiKey;

  const engines = [
    {
      id: 'web-speech' as const,
      label: 'Web Speech API',
      desc: 'Google\'un yerleşik ses tanıma. Türkçe dahil 50+ dil. İnternet gerektirir.',
      badge: 'ÜCRETSİZ',
      badgeColor: Colors.accent.emerald,
    },
    {
      id: 'whisper-openai' as const,
      label: 'OpenAI Whisper',
      desc: '100+ dil desteği, en yüksek doğruluk. OpenAI API anahtarı gerekir.',
      badge: 'EN İYİ',
      badgeColor: Colors.accent.primary,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#070710', '#0E0E1A']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ses Tanıma</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionLabel}>SES TANIMA MOTORU</Text>
        <View style={styles.section}>
          {engines.map((eng, i) => (
            <React.Fragment key={eng.id}>
              {i > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.engineRow}
                onPress={() => setDraft(d => ({ ...d, engine: eng.id }))}
                activeOpacity={0.75}
              >
                <View style={styles.engineInfo}>
                  <View style={styles.engineHeaderRow}>
                    <Text style={styles.engineLabel}>{eng.label}</Text>
                    <View style={[styles.badge, { backgroundColor: eng.badgeColor + '22', borderColor: eng.badgeColor + '55' }]}>
                      <Text style={[styles.badgeText, { color: eng.badgeColor }]}>{eng.badge}</Text>
                    </View>
                    {saved.engine === eng.id && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>AKTİF</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.engineDesc}>{eng.desc}</Text>
                </View>
                <Text style={[styles.radio, draft.engine === eng.id && { color: Colors.accent.primary }]}>
                  {draft.engine === eng.id ? '◉' : '○'}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {draft.engine === 'whisper-openai' && (
          <>
            <Text style={styles.sectionLabel}>OPENAI API ANAHTARI</Text>
            <View style={styles.section}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>API Anahtarı</Text>
                <TextInput
                  style={styles.input}
                  placeholder="sk-..."
                  placeholderTextColor={Colors.text.muted}
                  value={draft.openaiApiKey}
                  onChangeText={v => setDraft(d => ({ ...d, openaiApiKey: v }))}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}>
                  <Text style={styles.link}>platform.openai.com → API Keys →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {isDirty && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <LinearGradient colors={['#6C63FF', '#A78BFA']} style={styles.saveBtnGrad}>
              <Text style={styles.saveBtnText}>
                {saveSuccess ? '✓ Kaydedildi' : 'Kaydet'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>💡 Mikrofon kullanımı</Text>
          <Text style={styles.infoText}>
            Mikrofon butonuna basılı tutun → Türkçe konuşun → bırakın. Ses metne dönüştürülür ve otomatik çevrilir.{'\n\n'}
            Web Speech API: Google'ın ücretsiz servisi, cihazda çalışır.{'\n'}
            OpenAI Whisper: platform.openai.com'dan API anahtarı gerekir.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 22, color: Colors.text.primary },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text.primary },
  content: { padding: Spacing.base, paddingBottom: 60, gap: Spacing.sm },
  sectionLabel: {
    fontSize: 11, color: Colors.text.muted, letterSpacing: 2,
    textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: Spacing.xs,
  },
  section: {
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.bg.cardBorder, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.bg.cardBorder },
  engineRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.base, gap: Spacing.sm,
  },
  engineInfo: { flex: 1, gap: 4 },
  engineHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  engineLabel: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  activeBadge: {
    backgroundColor: Colors.accent.emerald + '22', borderRadius: 4,
    borderWidth: 1, borderColor: Colors.accent.emerald + '55',
    paddingHorizontal: 6, paddingVertical: 2,
  },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.accent.emerald },
  engineDesc: { fontSize: 12, color: Colors.text.muted, lineHeight: 17 },
  radio: { fontSize: 22, color: Colors.text.muted },
  fieldRow: { padding: Spacing.base, gap: Spacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
  input: {
    backgroundColor: Colors.bg.tertiary, borderRadius: BorderRadius.md,
    padding: Spacing.sm, color: Colors.text.primary, fontSize: 14,
    marginTop: 4, fontFamily: 'monospace',
  },
  link: { fontSize: 12, color: Colors.accent.primary, marginTop: 4 },
  saveBtn: {
    borderRadius: BorderRadius.full, overflow: 'hidden', marginTop: Spacing.md,
  },
  saveBtnGrad: {
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  infoBox: {
    marginTop: Spacing.md, padding: Spacing.base,
    backgroundColor: Colors.accent.primary + '10',
    borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.accent.primary + '30',
    gap: 8,
  },
  infoTitle: { fontSize: 14, fontWeight: '600', color: Colors.accent.secondary },
  infoText: { fontSize: 13, color: Colors.text.muted, lineHeight: 20 },
});
