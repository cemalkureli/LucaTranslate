import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VoiceState = 'idle' | 'recording' | 'processing' | 'error';

export interface VoiceSettings {
  engine: 'whisper-openai' | 'web-speech';
  openaiApiKey: string;
}

const VOICE_SETTINGS_KEY = 'lingua_voice_settings';
const SILENCE_MS = 5000;

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  engine: 'web-speech',
  openaiApiKey: '',
};

export const getVoiceSettings = async (): Promise<VoiceSettings> => {
  try {
    const raw = await AsyncStorage.getItem(VOICE_SETTINGS_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      engine: parsed.engine === 'whisper-openai' ? 'whisper-openai' : 'web-speech',
      openaiApiKey: parsed.openaiApiKey || '',
    };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
};

interface UseVoiceRecorderOptions {
  onTranscript: (text: string) => void;
  onPartial?: (text: string) => void;
  onError?: (error: string) => void;
}

let Voice: any = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch {
  Voice = null;
}

const VOICE_LOCALE: Record<string, string> = {
  tr: 'tr-TR', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
  it: 'it-IT', pt: 'pt-PT', ru: 'ru-RU', ar: 'ar-SA', zh: 'zh-CN',
  ja: 'ja-JP', ko: 'ko-KR', nl: 'nl-NL', pl: 'pl-PL', sv: 'sv-SE',
  da: 'da-DK', fi: 'fi-FI', cs: 'cs-CZ', hu: 'hu-HU', ro: 'ro-RO',
  uk: 'uk-UA', el: 'el-GR', he: 'he-IL', hi: 'hi-IN', id: 'id-ID',
  ms: 'ms-MY', th: 'th-TH', vi: 'vi-VN', fa: 'fa-IR', af: 'af-ZA',
  ca: 'ca-ES', sw: 'sw-KE', nb: 'nb-NO', sk: 'sk-SK', bg: 'bg-BG',
};

function toLocale(code: string): string {
  if (!code) return '';
  if (code.includes('-')) return code;
  return VOICE_LOCALE[code] ?? code;
}

async function transcribeWithOpenAI(uri: string, lang: string, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', { uri, type: 'audio/wav', name: 'voice.wav' } as any);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');
  if (lang && lang !== 'auto') formData.append('language', lang.split('-')[0]);
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  return (await res.text()).trim();
}

export function useVoiceRecorder(opts: UseVoiceRecorderOptions) {
  // Always-fresh ref so Voice event handlers never have stale closures
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  const [state, setState] = useState<VoiceState>('idle');
  const [partialText, setPartialText] = useState('');

  // Recording session state — all refs so Voice handlers see latest values
  const activeRef = useRef(false);      // recording session is live
  const stoppingRef = useRef(false);    // finalization requested
  const accumulatedRef = useRef('');    // text accumulated across sentence restarts
  const currentLangRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);  // Whisper only

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  // fnRef holds functions that must always be latest — used inside Voice event handlers
  const fnRef = useRef({ finalize: () => {}, resetTimer: () => {} });

  fnRef.current.finalize = () => {
    clearTimer();
    const text = accumulatedRef.current.trim();
    accumulatedRef.current = '';
    setPartialText('');
    activeRef.current = false;
    stoppingRef.current = false;
    setState('idle');
    if (text) optsRef.current.onTranscript(text);
  };

  fnRef.current.resetTimer = () => {
    clearTimer();
    // After SILENCE_MS of no new partial results, auto-stop
    timerRef.current = setTimeout(() => {
      if (!activeRef.current || stoppingRef.current) return;
      stoppingRef.current = true;
      Voice?.stop().catch(() => {});
      // Fallback: if onSpeechResults never fires after stop, finalize anyway
      timerRef.current = setTimeout(() => {
        if (stoppingRef.current) fnRef.current.finalize();
      }, 2000);
    }, SILENCE_MS);
  };

  // Register Voice event handlers once — fnRef keeps them fresh
  useEffect(() => {
    if (!Voice) return;

    Voice.onSpeechStart = () => {
      setState('recording');
      fnRef.current.resetTimer();
    };

    Voice.onSpeechPartialResults = (e: any) => {
      const partial = (e.value?.[0] ?? '').trim();
      if (!partial) return;
      const display = (accumulatedRef.current + ' ' + partial).trim();
      setPartialText(display);
      optsRef.current.onPartial?.(display);
      fnRef.current.resetTimer();  // reset 5s silence window
    };

    Voice.onSpeechResults = (e: any) => {
      clearTimer();
      const text = (e.value?.[0] ?? '').trim();

      if (!activeRef.current || stoppingRef.current) {
        // Finalization path (silence timer fired or user tapped stop)
        if (text) accumulatedRef.current = (accumulatedRef.current + ' ' + text).trim();
        fnRef.current.finalize();
        return;
      }

      // Still active → accumulate sentence + restart for next sentence
      if (text) {
        accumulatedRef.current = (accumulatedRef.current + ' ' + text).trim();
        setPartialText(accumulatedRef.current);
      }
      Voice.start(toLocale(currentLangRef.current)).catch(() => {});
      fnRef.current.resetTimer();
    };

    Voice.onSpeechEnd = () => {
      // Segment ended — onSpeechResults or onSpeechError will follow
    };

    Voice.onSpeechError = (e: any) => {
      const code = String(e.error?.code ?? '');
      const msg = String(e.error?.message ?? '');
      // Error 7 = no speech / silence — normal between sentences, just restart
      const isSilence =
        code === '7' ||
        msg.startsWith('7/') ||
        msg.toLowerCase().includes('no match') ||
        msg.toLowerCase().includes('no speech');

      if (isSilence) {
        if (activeRef.current && !stoppingRef.current) {
          Voice.start(toLocale(currentLangRef.current)).catch(() => {});
          // Timer keeps running — 5s since last partial
        } else {
          fnRef.current.finalize();
        }
        return;
      }

      // Real error
      clearTimer();
      activeRef.current = false;
      stoppingRef.current = false;
      accumulatedRef.current = '';
      setPartialText('');
      setState('error');
      const errMsg = msg.replace(/^\d+\//, '');
      optsRef.current.onError?.(errMsg || 'Ses tanıma hatası.');
      setTimeout(() => setState('idle'), 3000);
    };

    return () => { Voice.destroy().catch(() => {}); };
  }, [clearTimer]);

  const startListening = useCallback(async (lang: string = '') => {
    const settings = await getVoiceSettings();

    // ── OpenAI Whisper path ──
    if (settings.engine === 'whisper-openai') {
      if (!settings.openaiApiKey) {
        optsRef.current.onError?.('OpenAI API anahtarı eksik. Ayarlar → Ses tanıma.');
        return;
      }
      if (recordingRef.current) return;

      currentLangRef.current = lang;
      setState('recording');
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') { setState('idle'); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync({
          android: { extension: '.wav', outputFormat: Audio.AndroidOutputFormat.DEFAULT, audioEncoder: Audio.AndroidAudioEncoder.DEFAULT, sampleRate: 16000, numberOfChannels: 1, bitRate: 128000 },
          ios: { extension: '.wav', audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 16000, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
          web: { mimeType: 'audio/wav', bitsPerSecond: 128000 },
        });
        await rec.startAsync();
        recordingRef.current = rec;
      } catch {
        optsRef.current.onError?.('Kayıt başlatılamadı.');
        setState('error');
        setTimeout(() => setState('idle'), 3000);
      }
      return;
    }

    // ── Web Speech (Android native) ──
    if (!Voice) {
      optsRef.current.onError?.('Ses tanıma yüklü değil.');
      return;
    }
    if (activeRef.current) return;

    currentLangRef.current = lang;
    accumulatedRef.current = '';
    stoppingRef.current = false;
    activeRef.current = true;
    setPartialText('');
    setState('recording');

    try {
      await Voice.start(toLocale(lang));
    } catch {
      optsRef.current.onError?.('Ses tanıma başlatılamadı.');
      setState('error');
      activeRef.current = false;
      setTimeout(() => setState('idle'), 3000);
    }
  }, []);

  const stopListening = useCallback(async () => {
    const settings = await getVoiceSettings();

    // ── Whisper stop: finalize recording ──
    if (settings.engine === 'whisper-openai') {
      const rec = recordingRef.current;
      if (!rec) return;
      setState('processing');
      try {
        await rec.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const uri = rec.getURI();
        recordingRef.current = null;
        if (!uri) throw new Error('URI bulunamadı');
        const s = await getVoiceSettings();
        const text = await transcribeWithOpenAI(uri, currentLangRef.current, s.openaiApiKey);
        if (text) { setPartialText(''); optsRef.current.onTranscript(text); }
        setState('idle');
      } catch (err: any) {
        optsRef.current.onError?.(err.message || 'Ses tanıma başarısız.');
        setState('error');
        recordingRef.current = null;
        setTimeout(() => setState('idle'), 3000);
      }
      return;
    }

    // ── Web speech stop ──
    if (!activeRef.current || stoppingRef.current) return;
    clearTimer();
    stoppingRef.current = true;
    setState('processing');
    try {
      await Voice?.stop();
    } catch {
      fnRef.current.finalize();
    }
  }, [clearTimer]);

  const cancelListening = useCallback(async () => {
    clearTimer();
    activeRef.current = false;
    stoppingRef.current = false;
    accumulatedRef.current = '';
    setPartialText('');
    if (Voice) { try { await Voice.cancel(); } catch {} }
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    setState('idle');
  }, [clearTimer]);

  useEffect(() => () => { clearTimer(); }, [clearTimer]);

  return {
    state,
    partialText,
    startListening,
    stopListening,
    cancelListening,
    isRecording: state === 'recording',
    isProcessing: state === 'processing',
  };
}
