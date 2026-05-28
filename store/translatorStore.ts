import { create } from 'zustand';
import { translate, saveToHistory, getHistory, getSettings, AppSettings, DEFAULT_SETTINGS, HistoryItem } from '../services/translate';

interface TranslatorState {
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  isTranslating: boolean;
  translationError: string | null;
  detectedLang: string | null;
  settings: AppSettings;
  history: HistoryItem[];

  setSourceText: (text: string) => void;
  setSourceLang: (lang: string) => void;
  setTargetLang: (lang: string) => void;
  swapLanguages: () => void;
  performTranslation: () => Promise<void>;
  clearTranslation: () => void;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  loadHistory: () => Promise<void>;
}

let _translationId = 0;

export const useTranslatorStore = create<TranslatorState>((set, get) => ({
  sourceText: '',
  translatedText: '',
  sourceLang: 'auto',
  targetLang: 'tr',
  isTranslating: false,
  translationError: null,
  detectedLang: null,
  settings: DEFAULT_SETTINGS,
  history: [],

  setSourceText: (text) => set({ sourceText: text, translationError: null }),
  setSourceLang: (lang) => set({ sourceLang: lang, detectedLang: null }),
  setTargetLang: (lang) => set({ targetLang: lang }),

  swapLanguages: () => {
    const { sourceLang, targetLang, sourceText, translatedText } = get();
    if (sourceLang === 'auto') return;
    set({
      sourceLang: targetLang,
      targetLang: sourceLang,
      sourceText: translatedText,
      translatedText: sourceText,
      detectedLang: null,
    });
  },

  performTranslation: async () => {
    const myId = ++_translationId;
    const { sourceText, sourceLang, targetLang, settings } = get();

    if (!sourceText.trim()) {
      set({ translatedText: '', translationError: null });
      return;
    }

    set({ isTranslating: true, translationError: null });

    try {
      const result = await translate(
        { q: sourceText, source: sourceLang, target: targetLang },
        { preferredInstance: settings.preferredInstance, apiKey: settings.apiKey }
      );

      if (myId !== _translationId) { set({ isTranslating: false }); return; }

      if (result.error) {
        set({ translationError: result.error, isTranslating: false, translatedText: '' });
        return;
      }

      set({
        translatedText: result.translatedText,
        detectedLang: result.detectedLanguage?.language || null,
        isTranslating: false,
      });

      if (settings.saveHistory && result.translatedText) {
        await saveToHistory({
          sourceText,
          translatedText: result.translatedText,
          sourceLang: result.detectedLanguage?.language || sourceLang,
          targetLang,
        });
        get().loadHistory().catch(() => {});
      }
    } catch {
      if (myId !== _translationId) { set({ isTranslating: false }); return; }
      set({ translationError: 'Çeviri başarısız. İnternet bağlantınızı kontrol edin.', isTranslating: false });
    }
  },

  clearTranslation: () => set({
    sourceText: '',
    translatedText: '',
    translationError: null,
    detectedLang: null,
  }),

  loadSettings: async () => {
    const settings = await getSettings();
    set({
      settings,
      sourceLang: settings.defaultSourceLang,
      targetLang: settings.defaultTargetLang,
    });
  },

  updateSettings: async (newSettings) => {
    const { settings } = get();
    const { saveSettings } = await import('../services/translate');
    const updated = { ...settings, ...newSettings };
    await saveSettings(updated);
    set({ settings: updated });
  },

  loadHistory: async () => {
    const history = await getHistory();
    set({ history });
  },
}));
