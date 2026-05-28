import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LANGUAGES } from '../constants/theme';
import { Colors, Spacing, BorderRadius } from '../constants/theme';

interface LanguageSelectorProps {
  mode: 'source' | 'target';
  currentLang: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  showAuto?: boolean;
}

export default function LanguageSelector({
  mode, currentLang, onSelect, onClose, showAuto = false
}: LanguageSelectorProps) {
  const [search, setSearch] = useState('');

  const filteredLangs = useMemo(() => {
    const list = showAuto ? LANGUAGES : LANGUAGES.filter(l => l.code !== 'auto');
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  }, [search, showAuto]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={20} style={StyleSheet.absoluteFillObject} tint="dark" />
      </Pressable>
      
      <View style={styles.sheet}>
        <View style={styles.handle} />
        
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === 'source' ? 'Translate from' : 'Translate to'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search languages..."
            placeholderTextColor={Colors.text.muted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          data={filteredLangs}
          keyExtractor={item => item.code}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSelected = item.code === currentLang;
            return (
              <TouchableOpacity
                style={[styles.langItem, isSelected && styles.langItemActive]}
                onPress={() => onSelect(item.code)}
                activeOpacity={0.7}
              >
                <Text style={styles.langItemFlag}>{item.flag}</Text>
                <View style={styles.langItemInfo}>
                  <Text style={[styles.langItemName, isSelected && styles.langItemNameActive]}>
                    {item.nativeName}
                  </Text>
                  <Text style={styles.langItemSubname}>{item.name}</Text>
                </View>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '80%',
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.bg.cardBorder,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bg.card, justifyContent: 'center', alignItems: 'center',
  },
  closeIcon: { color: Colors.text.secondary, fontSize: 14 },
  
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg.card, borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.base, marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.bg.cardBorder,
    gap: Spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  clearSearch: { color: Colors.text.muted, fontSize: 14 },

  listContent: { paddingHorizontal: Spacing.base, paddingBottom: 40 },
  langItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, gap: Spacing.md,
    paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md,
  },
  langItemActive: { backgroundColor: Colors.accent.primary + '15' },
  langItemFlag: { fontSize: 24 },
  langItemInfo: { flex: 1 },
  langItemName: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  langItemNameActive: { color: Colors.accent.primary },
  langItemSubname: { fontSize: 12, color: Colors.text.muted, marginTop: 1 },
  checkmark: { fontSize: 16, color: Colors.accent.primary, fontWeight: '700' },
  separator: { height: 1, backgroundColor: Colors.bg.cardBorder, marginLeft: 52 },
});
