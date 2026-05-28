import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';

interface Props { current: number; max: number; }

export default function CharCounter({ current, max }: Props) {
  const pct = current / max;
  const color = pct > 0.9 ? '#F87171' : pct > 0.7 ? '#FBBF24' : Colors.text.muted;
  if (current === 0) return null;
  return <Text style={[styles.text, { color }]}>{current}/{max}</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 11, fontVariant: ['tabular-nums'] },
});
