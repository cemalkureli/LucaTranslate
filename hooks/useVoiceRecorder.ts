import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VoiceState = 'idle' | 'requesting' | 'recording' | 'processing' | 'error';

export interface VoiceSettings {
  engine: 'whisper-openai' | 'web-speech';
  openaiApiKey: string;
}

const VOICE_SETTINGS_KEY = 'lingua_voice_settings';

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
  language?: string;
}

// ─── Native Android Voice (uses Google's built-in SpeechRecognizer) ──────────
let Voice: any = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch {
  Voice = null;
}

// Maps ISO 639-1 codes → BCP-47 locales required by Android SpeechRecognizer
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
  if (code.includes('-')) return code;
  return VOICE_LOCALE[code] ?? code;
}

// ─── OpenAI Whisper backend ──────────────────────────────────────────────────
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
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  return (await res.text()).trim();
}

// ─── Main hook ───────────────────────────────────────────────────────────────
export function useVoiceRecorder(opts: UseVoiceRecorderOptions) {
  const [state, setState] = useState<VoiceState>('idle');
  const [partialText, setPartialText] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const voiceActiveRef = useRef(false);

  // Setup Voice listeners
  useEffect(() => {
    if (!Voice) return;

    Voice.onSpeechStart = () => setState('recording');
    Voice.onSpeechEnd = () => {
      if (voiceActiveRef.current) setState('processing');
    };
    Voice.onSpeechResults = (e: any) => {
      const text = e.value?.[0]?.trim();
      if (text) {
        opts.onTranscript(text);
        setPartialText('');
      }
      setState('idle');
      voiceActiveRef.current = false;
    };
    Voice.onSpeechPartialResults = (e: any) => {
      const text = e.value?.[0]?.trim();
      if (text) {
        setPartialText(text);
        opts.onPartial?.(text);
      }
    };
    Voice.onSpeechError = (e: any) => {
      const msg = e.error?.message || 'Voice error';
      // Ignore "recognition stopped" errors (user stopped manually)
      if (msg.includes('7') || msg.includes('No match')) {
        setState('idle');
      } else {
        opts.onError?.(msg);
        setState('error');
        setTimeout(() => setState('idle'), 3000);
      }
      voiceActiveRef.current = false;
    };

    return () => {
      Voice.destroy().catch(() => {});
    };
  }, []);

  const startListening = useCallback(async (lang: string = 'en') => {
    if (state !== 'idle') return;

    const voiceSettings = await getVoiceSettings();

    // ── OpenAI Whisper engine ──
    if (voiceSettings.engine === 'whisper-openai') {
      if (!voiceSettings.openaiApiKey) {
        opts.onError?.('OpenAI API anahtarı eksik. Ayarlar → Ses tanıma → API Anahtarı girin.');
        setState('error');
        setTimeout(() => setState('idle'), 3000);
        return;
      }

      setState('requesting');
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          setState('error');
          setTimeout(() => setState('idle'), 3000);
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          android: {
            extension: '.wav',
            outputFormat: Audio.AndroidOutputFormat.DEFAULT,
            audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.wav',
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: { mimeType: 'audio/wav', bitsPerSecond: 128000 },
        });
        await recording.startAsync();
        recordingRef.current = recording;
        setState('recording');
      } catch (err: any) {
        opts.onError?.('Kayıt başlatılamadı: ' + err.message);
        setState('error');
        setTimeout(() => setState('idle'), 3000);
      }
      return;
    }

    // ── Web Speech (Android native via @react-native-voice/voice) ──
    if (!Voice) {
      opts.onError?.('Google ses tanıma yüklü değil. Ayarlar → Ses Tanıma → Whisper motorunu deneyin.');
      setState('error');
      setTimeout(() => setState('idle'), 3000);
      return;
    }

    setState('requesting');
    try {
      await Voice.start(toLocale(lang));
      voiceActiveRef.current = true;
      setState('recording');
    } catch (err: any) {
      opts.onError?.('Ses tanıma başlatılamadı: ' + err.message);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }, [state, opts]);

  const stopListening = useCallback(async (lang: string = 'en') => {
    const voiceSettings = await getVoiceSettings();

    // OpenAI Whisper — stop recording and transcribe
    if (voiceSettings.engine === 'whisper-openai') {
      const recording = recordingRef.current;
      if (!recording || state !== 'recording') return;

      setState('processing');
      try {
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const uri = recording.getURI();
        recordingRef.current = null;
        if (!uri) throw new Error('Kayıt URI bulunamadı');

        const settings = await getVoiceSettings();
        const transcript = await transcribeWithOpenAI(uri, lang, settings.openaiApiKey);
        if (transcript) {
          opts.onTranscript(transcript);
          setPartialText('');
        }
        setState('idle');
      } catch (err: any) {
        opts.onError?.(err.message || 'Ses tanıma başarısız');
        setState('error');
        setTimeout(() => setState('idle'), 3000);
      }
      return;
    }

    // Native Voice — stop and let onSpeechResults handle the result
    if (Voice && voiceActiveRef.current) {
      try {
        await Voice.stop();
      } catch {}
    }
  }, [state, opts]);

  const cancelListening = useCallback(async () => {
    if (Voice) {
      try { await Voice.cancel(); } catch {}
    }
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    voiceActiveRef.current = false;
    setState('idle');
    setPartialText('');
  }, []);

  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

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
