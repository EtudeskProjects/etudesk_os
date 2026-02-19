/**
 * AudioBlock — TTS audio response player for study mode
 * Renders a play/pause button with progress bar and duration.
 * Auto-plays on first render when autoPlay prop is true.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Play, Pause, Volume2 } from 'lucide-react-native';
import { useAudioPlayerHook } from '../../../hooks/useAudioPlayer';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, BORDER } from '../../../constants/theme';
import { API_CONFIG } from '../../../constants/config';

interface AudioBlockProps {
  url: string;
  duration?: number;
  autoPlay?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioBlock({ url, duration: estimatedDuration, autoPlay }: AudioBlockProps) {
  const { colors } = useTheme();
  const fullUrl = url.startsWith('http') ? url : `${API_CONFIG.BASE_URL}${url}`;
  const { state, play, pause, stop } = useAudioPlayerHook(fullUrl);
  const hasAutoPlayed = useRef(false);

  // Auto-play on first render
  useEffect(() => {
    if (autoPlay && !hasAutoPlayed.current && !state.isLoading) {
      hasAutoPlayed.current = true;
      play();
    }
  }, [autoPlay, state.isLoading, play]);

  const displayDuration = state.duration > 0 ? state.duration : (estimatedDuration || 0);
  const progressWidth = state.progress * 100;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface || colors.background, borderColor: colors.borderColor }]}>
      <Pressable
        onPress={() => state.isPlaying ? pause() : play()}
        style={[styles.playButton, { backgroundColor: colors.primary }]}
      >
        {state.isPlaying ? (
          <Pause size={18} color="#fff" fill="#fff" />
        ) : (
          <Play size={18} color="#fff" fill="#fff" />
        )}
      </Pressable>

      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressWidth}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
        <View style={styles.timeRow}>
          <Volume2 size={12} color={colors.textSecondary} />
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {state.isPlaying || state.currentTime > 0
              ? formatTime(state.currentTime)
              : formatTime(displayDuration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER.radius.lg,
    borderWidth: 1,
    marginVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flex: 1,
    gap: 4,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
  },
});

export default AudioBlock;
