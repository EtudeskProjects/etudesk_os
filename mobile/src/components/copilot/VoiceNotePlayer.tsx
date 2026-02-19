/**
 * VoiceNotePlayer — Compact player for user voice note bubbles
 * Shows mic icon + simplified waveform + duration. Play on tap.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Mic, Play, Pause } from 'lucide-react-native';
import { useAudioPlayerHook } from '../../hooks/useAudioPlayer';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, BORDER } from '../../constants/theme';
import { API_CONFIG } from '../../constants/config';

interface VoiceNotePlayerProps {
  url: string;
  duration?: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VoiceNotePlayer({ url, duration: estimatedDuration }: VoiceNotePlayerProps) {
  const { colors } = useTheme();
  const fullUrl = url.startsWith('http') ? url : `${API_CONFIG.BASE_URL}${url}`;
  const { state, play, pause } = useAudioPlayerHook(fullUrl);

  const displayDuration = state.duration > 0 ? state.duration : (estimatedDuration || 0);

  // Simplified waveform bars
  const bars = [3, 5, 8, 6, 10, 7, 4, 9, 5, 7, 3, 6, 8, 4];

  return (
    <Pressable
      onPress={() => state.isPlaying ? pause() : play()}
      style={[styles.container, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
    >
      <View style={styles.iconWrap}>
        {state.isPlaying ? (
          <Pause size={14} color="#fff" fill="#fff" />
        ) : (
          <Mic size={14} color="#fff" />
        )}
      </View>

      <View style={styles.waveform}>
        {bars.map((height, i) => {
          const filled = state.progress > 0 && (i / bars.length) <= state.progress;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height,
                  backgroundColor: filled ? '#fff' : 'rgba(255,255,255,0.4)',
                },
              ]}
            />
          );
        })}
      </View>

      <Text style={styles.durationText}>
        {state.isPlaying ? formatTime(state.currentTime) : formatTime(displayDuration)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER.radius.lg,
    gap: SPACING.xs,
    minWidth: 140,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 14,
  },
  bar: {
    width: 2,
    borderRadius: 1,
  },
  durationText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
});

export default VoiceNotePlayer;
