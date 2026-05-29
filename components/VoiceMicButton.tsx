import React, { useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { VoiceState } from '../hooks/useVoiceRecorder';
import { Colors, BorderRadius } from '../constants/theme';
import { MicIcon, StopIcon } from './Icons';

interface VoiceMicButtonProps {
  state: VoiceState;
  onPress: () => void;
  size?: number;
}

export default function VoiceMicButton({
  state,
  onPress,
  size = 64,
}: VoiceMicButtonProps) {
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);
  const pulse3 = useSharedValue(1);
  const btnScale = useSharedValue(1);
  const innerGlow = useSharedValue(0);

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const isActive = isRecording || isProcessing;

  useEffect(() => {
    if (isRecording) {
      pulse1.value = withRepeat(
        withTiming(1.5, { duration: 900, easing: Easing.out(Easing.ease) }),
        -1, true
      );
      pulse2.value = withRepeat(
        withTiming(1.8, { duration: 1200, easing: Easing.out(Easing.ease) }),
        -1, true
      );
      pulse3.value = withRepeat(
        withTiming(2.2, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1, true
      );
      innerGlow.value = withTiming(1, { duration: 200 });
      btnScale.value = withSpring(0.92, { damping: 10 });
    } else if (isProcessing) {
      // Spinner-like
      pulse1.value = withRepeat(withTiming(1.3, { duration: 600 }), -1, true);
      pulse2.value = withRepeat(withTiming(1.6, { duration: 800 }), -1, true);
      cancelAnimation(pulse3);
      pulse3.value = withTiming(1, { duration: 200 });
      innerGlow.value = withTiming(0.5, { duration: 200 });
      btnScale.value = withSpring(1, { damping: 12 });
    } else {
      cancelAnimation(pulse1); cancelAnimation(pulse2); cancelAnimation(pulse3);
      pulse1.value = withTiming(1, { duration: 300 });
      pulse2.value = withTiming(1, { duration: 300 });
      pulse3.value = withTiming(1, { duration: 300 });
      innerGlow.value = withTiming(0, { duration: 200 });
      btnScale.value = withSpring(1, { damping: 12 });
    }
  }, [isRecording, isProcessing]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse1.value }],
    opacity: interpolate(pulse1.value, [1, 1.5], [0.35, 0]),
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse2.value }],
    opacity: interpolate(pulse2.value, [1, 1.8], [0.2, 0]),
  }));
  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse3.value }],
    opacity: interpolate(pulse3.value, [1, 2.2], [0.12, 0]),
  }));
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const ringColor = isProcessing ? Colors.accent.cyan : '#F472B6';

  return (
    <View style={[styles.wrapper, { width: size * 2.5, height: size * 2.5 }]}>
      {/* Pulse rings */}
      {isActive && (
        <>
          <Animated.View style={[styles.ring, ring3Style, {
            width: size * 2.2, height: size * 2.2,
            borderRadius: size * 1.1, backgroundColor: ringColor,
          }]} />
          <Animated.View style={[styles.ring, ring2Style, {
            width: size * 1.8, height: size * 1.8,
            borderRadius: size * 0.9, backgroundColor: ringColor,
          }]} />
          <Animated.View style={[styles.ring, ring1Style, {
            width: size * 1.5, height: size * 1.5,
            borderRadius: size * 0.75, backgroundColor: ringColor,
          }]} />
        </>
      )}

      {/* Main button */}
      <Animated.View style={btnStyle}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.btn,
            { width: size, height: size, borderRadius: size / 2 },
            pressed && styles.btnPressed,
          ]}
        >
          <LinearGradient
            colors={
              isRecording
                ? ['#F472B6', '#EC4899']
                : isProcessing
                ? ['#22D3EE', '#06B6D4']
                : ['#6C63FF', '#A78BFA']
            }
            style={[styles.btnGrad, { borderRadius: size / 2 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {isProcessing
              ? <Text style={{ fontSize: size * 0.3, color: '#fff' }}>⋯</Text>
              : isRecording
              ? <StopIcon size={size * 0.38} color="#fff" />
              : <MicIcon size={size * 0.38} color="#fff" strokeWidth={1.8} />
            }
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Compact inline mic button (for inside input card) ───────────────────────
export function InlineMicButton({
  state,
  onPress,
}: {
  state: VoiceState;
  onPress: () => void;
}) {
  const pulse = useSharedValue(1);
  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';

  useEffect(() => {
    if (isRecording) {
      pulse.value = withRepeat(withTiming(1.15, { duration: 700 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        style={[
          styles.inlineBtn,
          isRecording && styles.inlineBtnRecording,
          isProcessing && styles.inlineBtnProcessing,
        ]}
      >
        {isProcessing
          ? <Text style={{ fontSize: 14, color: '#fff' }}>⋯</Text>
          : isRecording
          ? <StopIcon size={16} color="#F472B6" />
          : <MicIcon size={16} color={Colors.text.secondary} strokeWidth={2} />
        }
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
  },
  btn: {
    overflow: 'hidden',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  btnPressed: { opacity: 0.85 },
  btnGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micIcon: {
    color: '#fff',
  },

  // Inline button styles
  inlineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.bg.cardBorder,
  },
  inlineBtnRecording: {
    backgroundColor: '#F472B620',
    borderColor: '#F472B6',
  },
  inlineBtnProcessing: {
    backgroundColor: Colors.accent.cyan + '20',
    borderColor: Colors.accent.cyan,
  },
  inlineMicIcon: { fontSize: 16 },
});
