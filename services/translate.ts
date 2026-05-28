import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// ─── Configuration ─────────────────────────────────────────────────────────
const LIBRE_TRANSLATE_INSTANCES = [
  'https://libretranslate.com',
];

// ─── Types ──────────────────────────────────────────────────────────────────
export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: { language: string; confidence: number };
  usedInstance?: string;
  error?: string;
}

export interface TranslationRequest {
  q: string;
  source: string;
  target: string;
  format?: 'text' | 'html';
}

// ─── Language Detection ─────────────────────────────────────────────────────
export const detectLanguage = async (
  text: string,
  instanceUrl?: string
): Promise<{ language: string; confidence: number }[]> => {
  const instance = instanceUrl || LIBRE_TRANSLATE_INSTANCES[0];
  try {
    const res = await axios.post(
      `${instance}/detect`,
      { q: text },
      { timeout: 8000, headers: { 'Content-Type': 'application/json' } }
    );
    return res.data;
  } catch {
    return [{ language: 'en', confidence: 0.5 }];
  }
};

// ─── Main Translation Function ──────────────────────────────────────────────
export const translate = async (
  request: TranslationRequest,
  options: {
    preferredInstance?: string;
    apiKey?: string;
    timeout?: number;
  } = {}
): Promise<TranslationResult> => {
  const { q, source, target } = request;

  if (!q.trim()) {
    return { translatedText: '' };
  }

  const instances = options.preferredInstance
    ? [options.preferredInstance, ...LIBRE_TRANSLATE_INSTANCES.filter(i => i !== options.preferredInstance)]
    : LIBRE_TRANSLATE_INSTANCES;

  const payload = {
    q,
    source: source === 'auto' ? 'auto' : source,
    target,
    format: 'text',
    ...(options.apiKey ? { api_key: options.apiKey } : {}),
  };

  for (const instance of instances) {
    try {
      const res = await axios.post(`${instance}/translate`, payload, {
        timeout: options.timeout || 8000,
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.data?.translatedText) {
        return {
          translatedText: res.data.translatedText,
          detectedLanguage: res.data.detectedLanguage,
          usedInstance: instance,
        };
      }
    } catch {
      continue;
    }
  }

  // MyMemory fallback — free, no API key required
  try {
    const langPair = `${source === 'auto' ? 'autodetect' : source}|${target}`;
    const res = await axios.get('https://api.mymemory.translated.net/get', {
      params: { q, langpair: langPair },
      timeout: 10000,
    });
    const data = res.data;
    const text = data?.responseData?.translatedText;
    const detectedLang = data?.responseData?.detectedLanguage || null;
    if (text && !text.includes('PLEASE SELECT') && text !== q) {
      return {
        translatedText: text,
        detectedLanguage: detectedLang ? { language: detectedLang, confidence: 0.8 } : undefined,
        usedInstance: 'mymemory',
      };
    }
  } catch {}

  return {
    translatedText: '',
    error: 'Çeviri başarısız. İnternet bağlantınızı kontrol edin.',
  };
};

// ─── Translation History ────────────────────────────────────────────────────
const HISTORY_KEY = 'lingua_history';
const MAX_HISTORY = 50;

export interface HistoryItem {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  isFavorite?: boolean;
}

export const saveToHistory = async (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
  try {
    const existing = await getHistory();
    const newItem: HistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    const updated = [newItem, ...existing].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return newItem;
  } catch {
    return null;
  }
};

export const getHistory = async (): Promise<HistoryItem[]> => {
  try {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const toggleFavorite = async (id: string): Promise<void> => {
  const history = await getHistory();
  const updated = history.map(item =>
    item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
  );
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
};

export const deleteHistoryItem = async (id: string): Promise<void> => {
  const history = await getHistory();
  const updated = history.filter(item => item.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
};

export const clearHistory = async (): Promise<void> => {
  await AsyncStorage.removeItem(HISTORY_KEY);
};

// ─── Settings ───────────────────────────────────────────────────────────────
const SETTINGS_KEY = 'lingua_settings';

export interface AppSettings {
  preferredInstance: string;
  apiKey: string;
  autoTranslate: boolean;
  autoTranslateDelay: number; // ms
  defaultSourceLang: string;
  defaultTargetLang: string;
  hapticFeedback: boolean;
  saveHistory: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  preferredInstance: LIBRE_TRANSLATE_INSTANCES[0],
  apiKey: '',
  autoTranslate: true,
  autoTranslateDelay: 800,
  defaultSourceLang: 'auto',
  defaultTargetLang: 'tr',
  hapticFeedback: true,
  saveHistory: true,
};

export const getSettings = async (): Promise<AppSettings> => {
  try {
    const data = await AsyncStorage.getItem(SETTINGS_KEY);
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: Partial<AppSettings>): Promise<void> => {
  const current = await getSettings();
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
};

export const LIBRE_INSTANCES = LIBRE_TRANSLATE_INSTANCES;
