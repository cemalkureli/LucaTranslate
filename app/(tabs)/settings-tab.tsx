import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';
import { useTranslatorStore } from '../../store/translatorStore';

export default function SettingsTabScreen() {
  const router = useRouter();
  const { settings, history } = useTranslatorStore();
  const favorites = history.filter(h => h.isFavorite).length;

  const items = [
    { icon: '🌐', label: 'Server', value: settings.preferredInstance.replace('https://', ''), route: '/settings' },
    { icon: '⚡', label: 'Auto Translate', value: settings.autoTranslate ? 'On' : 'Off', route: '/settings' },
    { icon: '🕐', label: 'Save History', value: settings.saveHistory ? 'On' : 'Off', route: '/settings' },
    { icon: '🔊', label: 'TTS Speed', value: 'Normal', route: '/settings' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#070710', '#0E0E1A']} style={StyleSheet.absoluteFillObject} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{history.length}</Text>
            <Text style={styles.statLabel}>Translations</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{favorites}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>40+</Text>
            <Text style={styles.statLabel}>Languages</Text>
          </View>
        </View>

        {/* Settings quick view */}
        <TouchableOpacity style={styles.settingsCard} onPress={() => router.push('/settings')} activeOpacity={0.8}>
          <View style={styles.settingsCardHeader}>
            <Text style={styles.settingsCardTitle}>App Settings</Text>
            <Text style={styles.settingsCardArrow}>→</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={[styles.settingsItem, i < items.length - 1 && styles.settingsItemBorder]}>
              <Text style={styles.settingsItemIcon}>{item.icon}</Text>
              <Text style={styles.settingsItemLabel}>{item.label}</Text>
              <Text style={styles.settingsItemValue} numberOfLines={1}>{item.value}</Text>
            </View>
          ))}
        </TouchableOpacity>

        <View style={styles.credits}>
          <Text style={styles.creditsTitle}>LucaTranslate</Text>
          <Text style={styles.creditsText}>v1.0 • 40+ Languages • Free & Offline</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { padding: Spacing.base, paddingBottom: Spacing.md },
  title: { fontSize: 28, fontWeight: '900', color: Colors.text.primary, letterSpacing: 1 },
  content: { padding: Spacing.base, gap: Spacing.base, paddingBottom: 80 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1, backgroundColor: Colors.bg.card, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
    padding: Spacing.base, alignItems: 'center',
  },
  statNum: { fontSize: 28, fontWeight: '800', color: Colors.accent.primary },
  statLabel: { fontSize: 12, color: Colors.text.muted, marginTop: 4 },
  settingsCard: {
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.bg.cardBorder, overflow: 'hidden',
  },
  settingsCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.bg.cardBorder,
  },
  settingsCardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  settingsCardArrow: { color: Colors.accent.primary, fontSize: 18 },
  settingsItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.base,
  },
  settingsItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.bg.cardBorder },
  settingsItemIcon: { fontSize: 18 },
  settingsItemLabel: { flex: 1, fontSize: 14, color: Colors.text.secondary },
  settingsItemValue: { fontSize: 13, color: Colors.text.muted, maxWidth: 180, textAlign: 'right' },
  credits: {
    alignItems: 'center', padding: Spacing['2xl'], gap: Spacing.xs,
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
  },
  creditsTitle: { fontSize: 12, color: Colors.text.muted, textTransform: 'uppercase', letterSpacing: 2 },
  creditsText: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  creditsUrl: { fontSize: 12, color: Colors.accent.primary },
});
