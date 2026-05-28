import React, { useEffect, useState } from 'react';
import {
  View, Text, Switch, TouchableOpacity, ScrollView,
  StyleSheet, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslatorStore } from '../store/translatorStore';
import { LIBRE_INSTANCES } from '../services/translate';
import { Colors, Spacing, BorderRadius, LANGUAGES } from '../constants/theme';

const OCR_KEY_STORAGE = 'lingua_ocr_api_key';

type ConnStatus = 'idle' | 'testing' | 'ok' | 'error';

async function testServer(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${url.replace(/\/$/, '')}/languages`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useTranslatorStore();

  const [connStatus, setConnStatus] = useState<Record<string, ConnStatus>>({});
  const [customUrl, setCustomUrl] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [ocrApiKey, setOcrApiKey] = useState('');
  const [ocrTestStatus, setOcrTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');

  useEffect(() => {
    const isCustom = !LIBRE_INSTANCES.includes(settings.preferredInstance);
    if (isCustom) {
      setCustomUrl(settings.preferredInstance);
      setCustomKey(settings.apiKey);
    }
    AsyncStorage.getItem(OCR_KEY_STORAGE).then(v => {
      if (v) { setOcrApiKey(v); setOcrTestStatus('ok'); }
    });
  }, []);

  const saveOcrKey = async (key: string) => {
    setOcrApiKey(key);
    setOcrTestStatus('idle');
    await AsyncStorage.setItem(OCR_KEY_STORAGE, key.trim());
  };

  const testOcrKey = () => {
    const key = ocrApiKey.trim();
    if (!key) return;
    // OCR.space free keys: K followed by digits, length 10-20
    const valid = /^K[A-Za-z0-9]{5,25}$/.test(key);
    setOcrTestStatus(valid ? 'ok' : 'error');
  };

  const handleTest = async (url: string) => {
    if (!url) return;
    setConnStatus(s => ({ ...s, [url]: 'testing' }));
    const ok = await testServer(url);
    setConnStatus(s => ({ ...s, [url]: ok ? 'ok' : 'error' }));
  };

  const handleSelectInstance = (url: string) => {
    updateSettings({ preferredInstance: url });
  };

  const handleConnectCustomAndSave = async () => {
    const url = customUrl.trim().replace(/\/$/, '');
    if (!url) return;
    setConnStatus(s => ({ ...s, [url]: 'testing' }));
    const ok = await testServer(url);
    setConnStatus(s => ({ ...s, [url]: ok ? 'ok' : 'error' }));
    if (ok) {
      updateSettings({ preferredInstance: url, apiKey: customKey });
    }
  };

  const StatusDot = ({ url }: { url: string }) => {
    const st = connStatus[url];
    if (!st || st === 'idle') return null;
    if (st === 'testing') return <ActivityIndicator size="small" color={Colors.accent.cyan} style={{ marginLeft: 6 }} />;
    const color = st === 'ok' ? Colors.accent.emerald : Colors.accent.pink;
    const label = st === 'ok' ? '● Bağlı' : '● Hata';
    return <Text style={[styles.statusDot, { color }]}>{label}</Text>;
  };

  const toggle = (key: keyof typeof settings, value: boolean) => {
    updateSettings({ [key]: value });
  };

  const isCustomSelected = !LIBRE_INSTANCES.includes(settings.preferredInstance);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#070710', '#0E0E1A']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ayarlar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Translation */}
        <Text style={styles.sectionLabel}>ÇEVİRİ</Text>
        <View style={styles.section}>
          <SettingRow
            label="Otomatik Çeviri"
            subtitle="Yazarken çevir"
            value={settings.autoTranslate}
            onToggle={(v) => toggle('autoTranslate', v)}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Geçmişi Kaydet"
            subtitle="Çeviri geçmişini sakla"
            value={settings.saveHistory}
            onToggle={(v) => toggle('saveHistory', v)}
          />
        </View>

        {/* Servers */}
        <Text style={styles.sectionLabel}>SUNUCULAR</Text>
        <View style={styles.section}>
          {LIBRE_INSTANCES.map((instance, i) => {
            const isSelected = settings.preferredInstance === instance;
            const st = connStatus[instance];
            return (
              <React.Fragment key={instance}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.instanceRow}>
                  <TouchableOpacity
                    style={styles.instanceLeft}
                    onPress={() => handleSelectInstance(instance)}
                  >
                    <Text style={[styles.instanceUrl, isSelected && { color: Colors.text.primary }]}>
                      {instance.replace('https://', '')}
                    </Text>
                    <View style={styles.instanceBadges}>
                      <Text style={styles.officialBadge}>Resmi</Text>
                      <StatusDot url={instance} />
                    </View>
                  </TouchableOpacity>
                  <View style={styles.instanceRight}>
                    <TouchableOpacity
                      style={styles.testBtn}
                      onPress={() => handleTest(instance)}
                      disabled={st === 'testing'}
                    >
                      <Text style={styles.testBtnText}>
                        {st === 'testing' ? '...' : 'Test'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.radioIcon, isSelected && { color: Colors.accent.primary }]}>
                      {isSelected ? '◉' : '○'}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })}

          <View style={styles.divider} />

          {/* Custom Server */}
          <View style={styles.customBlock}>
            <View style={styles.customHeader}>
              <Text style={styles.customLabel}>Özel Sunucu</Text>
              {isCustomSelected && (
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>AKTİF</Text>
                </View>
              )}
              <StatusDot url={customUrl.trim()} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="https://sunucu.com"
              placeholderTextColor={Colors.text.muted}
              value={customUrl}
              onChangeText={setCustomUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextInput
              style={[styles.input, { marginTop: 6 }]}
              placeholder="API Anahtarı (opsiyonel)"
              placeholderTextColor={Colors.text.muted}
              value={customKey}
              onChangeText={setCustomKey}
              secureTextEntry
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.connectBtn, !customUrl && styles.connectBtnDisabled]}
              onPress={handleConnectCustomAndSave}
              disabled={!customUrl}
            >
              <LinearGradient
                colors={['#6C63FF', '#A78BFA']}
                style={styles.connectBtnGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {connStatus[customUrl.trim()] === 'testing' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.connectBtnText}>
                    {connStatus[customUrl.trim()] === 'ok' ? '✓ Bağlandı — Aktif Et' : 'Bağlan & Aktif Et'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Defaults */}
        <Text style={styles.sectionLabel}>VARSAYILAN DİL</Text>
        <View style={styles.section}>
          <View style={styles.defaultRow}>
            <Text style={styles.defaultLabel}>Varsayılan Hedef Dil</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['tr', 'en', 'de', 'fr', 'es', 'ja', 'zh', 'ar', 'ru', 'pt'].map(code => {
                const lang = LANGUAGES.find(l => l.code === code);
                return (
                  <TouchableOpacity
                    key={code}
                    style={[styles.defaultChip, settings.defaultTargetLang === code && styles.defaultChipActive]}
                    onPress={() => updateSettings({ defaultTargetLang: code })}
                  >
                    <Text style={styles.defaultChipFlag}>{lang?.flag}</Text>
                    <Text style={[styles.defaultChipText, settings.defaultTargetLang === code && styles.defaultChipTextActive]}>
                      {lang?.nativeName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Voice */}
        <Text style={styles.sectionLabel}>SES & MİKROFON</Text>
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.settingRow, { justifyContent: 'space-between' }]}
            onPress={() => router.push('/voice-settings')}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>🎤 Ses Tanıma Ayarları</Text>
              <Text style={styles.settingSubtitle}>Motor seçimi, API anahtarı</Text>
            </View>
            <Text style={{ color: Colors.text.muted, fontSize: 22 }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* OCR */}
        <Text style={styles.sectionLabel}>GÖRSEL METİN TANIMA (OCR)</Text>
        <View style={styles.section}>
          <View style={styles.customBlock}>
            <Text style={styles.customLabel}>OCR API Anahtarı</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="K_..."
                placeholderTextColor={Colors.text.muted}
                value={ocrApiKey}
                onChangeText={saveOcrKey}
                onSubmitEditing={testOcrKey}
                returnKeyType="done"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.testBtn}
                onPress={testOcrKey}
                disabled={!ocrApiKey || ocrTestStatus === 'testing'}
              >
                {ocrTestStatus === 'testing'
                  ? <ActivityIndicator size="small" color={Colors.accent.cyan} />
                  : <Text style={styles.testBtnText}>
                      {ocrTestStatus === 'ok' ? '✓' : ocrTestStatus === 'error' ? '✕' : 'Test'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
            {ocrTestStatus === 'ok' && <Text style={[styles.statusDot, { color: Colors.accent.emerald, marginTop: 4 }]}>● Bağlandı</Text>}
            {ocrTestStatus === 'error' && <Text style={[styles.statusDot, { color: Colors.accent.pink, marginTop: 4 }]}>● Geçersiz anahtar</Text>}
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>HAKKINDA</Text>
        <View style={styles.section}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>LucaTranslate</Text>
            <Text style={styles.aboutValue}>v1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Motor</Text>
            <Text style={styles.aboutValue}>LibreTranslate</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Dil Desteği</Text>
            <Text style={styles.aboutValue}>40+ dil</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({ label, subtitle, value, onToggle }: {
  label: string; subtitle: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.bg.tertiary, true: Colors.accent.primary }}
        thumbColor="#fff"
      />
    </View>
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
    paddingHorizontal: Spacing.xs,
  },
  section: {
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.bg.cardBorder, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.bg.cardBorder, marginLeft: Spacing.base },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.base,
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: Colors.text.primary },
  settingSubtitle: { fontSize: 12, color: Colors.text.muted, marginTop: 2 },

  // Server rows
  instanceRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: 8,
  },
  instanceLeft: { flex: 1, gap: 4 },
  instanceUrl: { fontSize: 14, color: Colors.text.secondary, fontFamily: 'monospace' },
  instanceBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  officialBadge: {
    fontSize: 10, color: Colors.accent.emerald,
    backgroundColor: Colors.accent.emerald + '20',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  statusDot: { fontSize: 12, fontWeight: '600' },
  instanceRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  testBtn: {
    backgroundColor: Colors.bg.tertiary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
  },
  testBtnText: { fontSize: 12, color: Colors.text.secondary, fontWeight: '600' },
  radioIcon: { fontSize: 20, color: Colors.text.muted },

  // Custom server block
  customBlock: { padding: Spacing.base, gap: 6 },
  customHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  customLabel: { fontSize: 14, color: Colors.text.secondary, fontWeight: '500' },
  activePill: {
    backgroundColor: Colors.accent.primary + '22', borderRadius: 4,
    borderWidth: 1, borderColor: Colors.accent.primary + '55',
    paddingHorizontal: 6, paddingVertical: 2,
  },
  activePillText: { fontSize: 10, fontWeight: '700', color: Colors.accent.primary },
  input: {
    backgroundColor: Colors.bg.tertiary, borderRadius: BorderRadius.md,
    padding: Spacing.sm, color: Colors.text.primary, fontSize: 13,
    fontFamily: 'monospace',
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
  },
  connectBtn: { borderRadius: BorderRadius.full, overflow: 'hidden', marginTop: 8 },
  connectBtnDisabled: { opacity: 0.4 },
  connectBtnGrad: {
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  connectBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Defaults
  defaultRow: { padding: Spacing.base, gap: Spacing.sm },
  defaultLabel: { fontSize: 14, color: Colors.text.secondary, marginBottom: 4 },
  defaultChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.bg.tertiary, borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 6, marginRight: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  defaultChipActive: {
    backgroundColor: Colors.accent.primary + '20',
    borderColor: Colors.accent.primary,
  },
  defaultChipFlag: { fontSize: 14 },
  defaultChipText: { fontSize: 13, color: Colors.text.muted },
  defaultChipTextActive: { color: Colors.accent.primary },

  // About
  aboutRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: Spacing.base,
  },
  aboutLabel: { fontSize: 15, color: Colors.text.primary },
  aboutValue: { fontSize: 14, color: Colors.text.muted },
});
