/**
 * useAudioPlayer Hook
 * Wraps expo-audio's useAudioPlayer for playback of TTS responses and voice notes.
 * Provides play/pause/stop controls with state tracking.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAudioPlayer as useExpoAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';

export interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  progress: number; // 0-1
  currentTime: number; // seconds
  duration: number; // seconds
}

interface UseAudioPlayerReturn {
  state: AudioPlayerState;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (position: number) => void;
}

export function useAudioPlayerHook(url: string | null): UseAudioPlayerReturn {
  const player = useExpoAudioPlayer(url || undefined);
  const status = useAudioPlayerStatus(player);
  const hasSetAudioMode = useRef(false);

  // Ensure audio mode allows playback
  useEffect(() => {
    if (url && !hasSetAudioMode.current) {
      hasSetAudioMode.current = true;
      setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      }).catch(() => {});
    }
  }, [url]);

  const state: AudioPlayerState = {
    isPlaying: status.playing,
    isLoading: !status.isLoaded,
    currentTime: status.currentTime ?? 0,
    duration: status.duration ?? 0,
    progress: (status.duration && status.duration > 0)
      ? (status.currentTime ?? 0) / status.duration
      : 0,
  };

  const play = useCallback(() => {
    // If audio finished (at end), seek to beginning before playing
    const dur = status.duration ?? 0;
    const cur = status.currentTime ?? 0;
    if (dur > 0 && cur >= dur - 0.1) {
      player.seekTo(0);
    }
    player.play();
  }, [player, status.duration, status.currentTime]);

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  const stop = useCallback(() => {
    player.pause();
    player.seekTo(0);
  }, [player]);

  const seek = useCallback((position: number) => {
    player.seekTo(position);
  }, [player]);

  return { state, play, pause, stop, seek };
}

export default useAudioPlayerHook;
