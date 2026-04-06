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
import { SPACING, BORDER, TYPOGRAPHY, OPACITY, withOpacity } from '../../../constants/theme';
import { API_CONFIG } from '../../../constants/config';
import { getLabelDirect } from '../../../utils/labels';

interface AudioBlockProps {
  url: string;
  duration?: number;
  autoPlay?: boolean;
}

function sanitizeText(value: unknown, max = 400): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? text.slice(0, max).trimEnd() : text;
}

function formatTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioBlock({ url, duration: estimatedDuration, autoPlay }: AudioBlockProps) {
  const { colors } = useTheme();
  const safeUrl = sanitizeText(url);
  const fullUrl = safeUrl
    ? safeUrl.startsWith('http')
      ? safeUrl
      : `${API_CONFIG.BASE_URL}${safeUrl.startsWith('/') ? '' : '/'}${safeUrl}`
    : '';
  const { state, play, pause, stop } = useAudioPlayerHook(fullUrl);
  const hasAutoPlayed = useRef(false);

  // Auto-play on first render
  useEffect(() => {
    if (safeUrl && autoPlay && !hasAutoPlayed.current && !state.isLoading) {
      hasAutoPlayed.current = true;
      play();
    }
  }, [autoPlay, safeUrl, state.isLoading, play]);

  useEffect(() => () => {
    stop();
  }, [stop]);

  if (!safeUrl) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface || colors.background, borderColor: colors.borderColor }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{getLabelDirect('noData')}</Text>
      </View>
    );
  }

  const safeEstimatedDuration = Number.isFinite(estimatedDuration) && (estimatedDuration || 0) > 0 ? estimatedDuration! : 0;
  const displayDuration = state.duration > 0 ? state.duration : safeEstimatedDuration;
  const currentTime = Math.min(
    Number.isFinite(state.currentTime) && state.currentTime > 0 ? state.currentTime : 0,
    displayDuration || Number.MAX_SAFE_INTEGER
  );
  const progressWidth = Math.max(0, Math.min(100, (Number.isFinite(state.progress) ? state.progress : 0) * 100));

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
        <View style={[styles.progressBarBg, { backgroundColor: withOpacity(colors.textDisabled, OPACITY[15]) }]}>
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
            {displayDuration > 0
              ? `${formatTime(currentTime)} / ${formatTime(displayDuration)}`
              : formatTime(currentTime)}
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
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 11,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    flex: 1,
  },
});

export default AudioBlock;
