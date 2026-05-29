import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VoiceState = 'idle' | 'recording' | 'processing' | 'error';

export interface VoiceSettings {
  engine: 'whisper-openai' | 'web-speech';
  openaiApiKey: string;
}

const VOICE_SETTINGS_KEY = 'lingua_voice_settings';
const SILENCE_MS = 3000;   // 3s of no new speech → auto-stop
const CHECK_INTERVAL = 300; // check every 300ms

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

// Android extras: tell SpeechRecognizer to wait longer before cutting off
const ANDROID_OPTS = {
  EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 3000,
  EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 3000,
  EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 30000,
};

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
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  const [state, setState] = useState<VoiceState>('idle');
  const [partialText, setPartialText] = useState('');

  const activeRef = useRef(false);
  const stoppingRef = useRef(false);
  const accumulatedRef = useRef('');
  const lastPartialRef = useRef('');
  const currentLangRef = useRef('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recognizerActiveRef = useRef(false);
  const pendingRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastSpeechRef = useRef(0);
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearSilenceCheck = useCallback(() => {
    if (silenceIntervalRef.current) {
      clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
  }, []);

  const clearPendingRestart = useCallback(() => {
    if (pendingRestartRef.current) {
      clearTimeout(pendingRestartRef.current);
      pendingRestartRef.current = null;
    }
  }, []);

  // fnRef: always-fresh functions for use inside Voice event handlers
  const fnRef = useRef({ finalize: () => {}, triggerStop: () => {} });

  fnRef.current.finalize = () => {
    clearSilenceCheck();
    clearPendingRestart();
    const text = accumulatedRef.current.trim() || lastPartialRef.current.trim();
    accumulatedRef.current = '';
    lastPartialRef.current = '';
    setPartialText('');
    activeRef.current = false;
    stoppingRef.current = false;
    setState('idle');
    if (text) optsRef.current.onTranscript(text);
  };

  fnRef.current.triggerStop = () => {
    if (!activeRef.current || stoppingRef.current) return;
    stoppingRef.current = true;
    clearSilenceCheck();
    clearPendingRestart();
    if (recognizerActiveRef.current) {
      recognizerActiveRef.current = false;
      try { Voice?.stop().catch(() => {}); } catch {}
    } else {
      fnRef.current.finalize();
      return;
    }
    setTimeout(() => { if (stoppingRef.current) fnRef.current.finalize(); }, 2000);
  };

  const startSilenceCheck = useCallback(() => {
    clearSilenceCheck();
    lastSpeechRef.current = Date.now();
    silenceIntervalRef.current = setInterval(() => {
      if (!activeRef.current || stoppingRef.current) {
        clearSilenceCheck();
        return;
      }
      if (Date.now() - lastSpeechRef.current >= SILENCE_MS) {
        fnRef.current.triggerStop();
      }
    }, CHECK_INTERVAL);
  }, [clearSilenceCheck]);

  useEffect(() => {
    if (!Voice) return;

    Voice.onSpeechStart = () => {
      // Stale start from a cancelled session — kill it immediately
      if (!activeRef.current) {
        try { Voice.cancel().catch(() => {}); } catch {}
        return;
      }
      recognizerActiveRef.current = true;
      setState('recording');
    };

    Voice.onSpeechPartialResults = (e: any) => {
      if (!activeRef.current) return;
      const partial = (e.value?.[0] ?? '').trim();
      if (!partial) return;
      const display = (accumulatedRef.current + ' ' + partial).trim();
      lastPartialRef.current = display;
      setPartialText(display);
      optsRef.current.onPartial?.(display);
      lastSpeechRef.current = Date.now();
    };

    Voice.onSpeechResults = (e: any) => {
      recognizerActiveRef.current = false;
      const text = (e.value?.[0] ?? '').trim();

      if (!activeRef.current || stoppingRef.current) {
        // Our silence check fired → finalize
        if (text) accumulatedRef.current = (accumulatedRef.current + ' ' + text).trim();
        fnRef.current.finalize();
        return;
      }

      // Android stopped mid-session — accumulate + restart
      if (text) {
        accumulatedRef.current = (accumulatedRef.current + ' ' + text).trim();
        setPartialText(accumulatedRef.current);
        lastSpeechRef.current = Date.now();
      }
      clearPendingRestart();
      pendingRestartRef.current = setTimeout(() => {
        pendingRestartRef.current = null;
        if (!activeRef.current || stoppingRef.current) return;
        try { Voice.start(toLocale(currentLangRef.current), ANDROID_OPTS).catch(() => {}); } catch {}
      }, 100);
    };

    Voice.onSpeechEnd = () => {
      // Segment ended — onSpeechResults or onSpeechError will follow
    };

    Voice.onSpeechError = (e: any) => {
      recognizerActiveRef.current = false;
      const code = String(e.error?.code ?? '');
      const msg = String(e.error?.message ?? '');
      const isSilence =
        code === '7' ||
        msg.startsWith('7/') ||
        msg.toLowerCase().includes('no match') ||
        msg.toLowerCase().includes('no speech');
      // ERROR_RECOGNIZER_BUSY: previous session still alive, cancel and retry with longer gap
      const isBusy = code === '8';

      if (isSilence || isBusy) {
        if (activeRef.current && !stoppingRef.current) {
          const delay = isBusy ? 350 : 100;
          clearPendingRestart();
          pendingRestartRef.current = setTimeout(async () => {
            pendingRestartRef.current = null;
            if (!activeRef.current || stoppingRef.current) return;
            if (isBusy) try { await Voice.cancel().catch(() => {}); } catch {}
            try { Voice.start(toLocale(currentLangRef.current), ANDROID_OPTS).catch(() => {}); } catch {}
          }, delay);
        } else {
          fnRef.current.finalize();
        }
        return;
      }

      // Any error while intentionally stopping → treat as normal stop, don't lose text
      if (stoppingRef.current) {
        fnRef.current.finalize();
        return;
      }

      // Real error
      clearSilenceCheck();
      clearPendingRestart();
      activeRef.current = false;
      stoppingRef.current = false;
      accumulatedRef.current = '';
      lastPartialRef.current = '';
      setPartialText('');
      setState('error');
      const errMsg = msg.replace(/^\d+\//, '');
      optsRef.current.onError?.(errMsg || 'Ses tanıma hatası.');
      setTimeout(() => setState('idle'), 3000);
    };

    return () => { Voice.destroy().catch(() => {}); };
  }, [clearSilenceCheck]);

  const startListening = useCallback(async (lang: string = '') => {
    const settings = await getVoiceSettings();

    // ── OpenAI Whisper ──
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
    recognizerActiveRef.current = false;
    setPartialText('');
    setState('recording');
    startSilenceCheck();

    try {
      await Voice.start(toLocale(lang), ANDROID_OPTS);
    } catch {
      optsRef.current.onError?.('Ses tanıma başlatılamadı.');
      setState('error');
      activeRef.current = false;
      clearSilenceCheck();
      setTimeout(() => setState('idle'), 3000);
    }
  }, [startSilenceCheck, clearSilenceCheck]);

  const stopListening = useCallback(async () => {
    const settings = await getVoiceSettings();

    // ── Whisper stop ──
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

    // ── Web speech stop (user tapped stop button) ──
    fnRef.current.triggerStop();
  }, []);

  const cancelListening = useCallback(async () => {
    clearSilenceCheck();
    clearPendingRestart();
    activeRef.current = false;
    stoppingRef.current = false;
    accumulatedRef.current = '';
    lastPartialRef.current = '';
    setPartialText('');
    if (Voice) { try { await Voice.cancel(); } catch {} }
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    setState('idle');
  }, [clearSilenceCheck]);

  useEffect(() => () => { clearSilenceCheck(); clearPendingRestart(); }, [clearSilenceCheck, clearPendingRestart]);

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
