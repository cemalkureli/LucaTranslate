import { create } from 'zustand';

export interface OcrHistoryItem {
  id: string;
  imageUri: string;
  originalText: string;
  translatedText: string;
  targetLang: string;
  timestamp: number;
}

interface OcrHistoryState {
  items: OcrHistoryItem[];
  addItem: (item: Omit<OcrHistoryItem, 'id' | 'timestamp'>) => OcrHistoryItem;
  removeItem: (id: string) => void;
}

export const useOcrHistoryStore = create<OcrHistoryState>((set) => ({
  items: [],
  addItem: (item) => {
    const newItem: OcrHistoryItem = {
      ...item,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    set((state) => ({
      items: [newItem, ...state.items].slice(0, 30),
    }));
    return newItem;
  },
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
}));
