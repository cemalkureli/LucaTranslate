import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslatorStore } from '../store/translatorStore';
import { toggleFavorite, deleteHistoryItem, clearHistory, HistoryItem } from '../services/translate';
import { LANGUAGES, Colors, Spacing, BorderRadius } from '../constants/theme';

export default function HistoryScreen() {
  const router = useRouter();
  const { history, loadHistory, setSourceText, setSourceLang, setTargetLang } = useTranslatorStore();
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');

  useEffect(() => { loadHistory(); }, []);

  const filtered = filter === 'favorites' ? history.filter(h => h.isFavorite) : history;

  const handleToggleFavorite = async (id: string) => {
    await toggleFavorite(id);
    await loadHistory();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete', 'Remove this translation from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteHistoryItem(id); loadHistory(); }
      }
    ]);
  };

  const handleReuse = (item: HistoryItem) => {
    setSourceText(item.sourceText);
    setSourceLang(item.sourceLang);
    setTargetLang(item.targetLang);
    router.back();
  };

  const handleClearAll = () => {
    Alert.alert('Clear History', 'Delete all translation history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive',
        onPress: async () => { await clearHistory(); loadHistory(); }
      }
    ]);
  };

  const renderItem = ({ item, index }: { item: HistoryItem; index: number }) => {
    const srcLang = LANGUAGES.find(l => l.code === item.sourceLang);
    const tgtLang = LANGUAGES.find(l => l.code === item.targetLang);
    const date = new Date(item.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
        <TouchableOpacity style={styles.card} onPress={() => handleReuse(item)} activeOpacity={0.8}>
          <View style={styles.cardHeader}>
            <View style={styles.langPair}>
              <Text style={styles.langFlag}>{srcLang?.flag || '🌐'}</Text>
              <Text style={styles.langArrow}>→</Text>
              <Text style={styles.langFlag}>{tgtLang?.flag || '🌐'}</Text>
              <Text style={styles.langNames}>
                {srcLang?.name || item.sourceLang} → {tgtLang?.name || item.targetLang}
              </Text>
            </View>
            <View style={styles.cardActions}>
              <Text style={styles.timestamp}>{dateStr} {timeStr}</Text>
              <TouchableOpacity onPress={() => handleToggleFavorite(item.id)} style={styles.favBtn}>
                <Text style={styles.favIcon}>{item.isFavorite ? '★' : '☆'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.delBtn}>
                <Text style={styles.delIcon}>🗑</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.textPair}>
            <Text style={styles.sourceText} numberOfLines={2}>{item.sourceText}</Text>
            <View style={styles.divider} />
            <Text style={styles.translatedText} numberOfLines={2}>{item.translatedText}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#070710', '#0E0E1A']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>History</Text>
        <TouchableOpacity onPress={handleClearAll}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        {(['all', 'favorites'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? '🕐 All' : '★ Favorites'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{filter === 'favorites' ? '☆' : '🕐'}</Text>
            <Text style={styles.emptyText}>
              {filter === 'favorites' ? 'No favorites yet' : 'No translation history'}
            </Text>
          </View>
        )}
      />
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
  clearText: { fontSize: 14, color: '#F87171' },

  filterBar: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, marginBottom: Spacing.base,
  },
  filterBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, borderWidth: 1,
    borderColor: Colors.bg.cardBorder, backgroundColor: Colors.bg.card,
  },
  filterBtnActive: {
    backgroundColor: Colors.accent.primary + '20',
    borderColor: Colors.accent.primary,
  },
  filterText: { fontSize: 13, color: Colors.text.muted, fontWeight: '500' },
  filterTextActive: { color: Colors.accent.primary },

  list: { paddingHorizontal: Spacing.base, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
    padding: Spacing.base, marginBottom: Spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  langPair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  langFlag: { fontSize: 16 },
  langArrow: { fontSize: 12, color: Colors.text.muted },
  langNames: { fontSize: 12, color: Colors.text.muted, marginLeft: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  timestamp: { fontSize: 11, color: Colors.text.muted },
  favBtn: { padding: 4 },
  favIcon: { fontSize: 18, color: Colors.accent.amber },
  delBtn: { padding: 4 },
  delIcon: { fontSize: 14 },
  textPair: { gap: 8 },
  sourceText: { fontSize: 14, color: Colors.text.secondary, lineHeight: 20 },
  divider: { height: 1, backgroundColor: Colors.bg.cardBorder },
  translatedText: { fontSize: 14, color: Colors.text.primary, fontWeight: '500', lineHeight: 20 },
  empty: { alignItems: 'center', marginTop: 80, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: Colors.text.muted },
});
