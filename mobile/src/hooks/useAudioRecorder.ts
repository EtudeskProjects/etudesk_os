/**
 * useAudioRecorder Hook
 * Manages audio recording with expo-audio, limited to 30 seconds
 * Designed for voice-to-text input in the Copilot
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
    useAudioRecorder as useExpoAudioRecorder,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    RecordingPresets,
} from 'expo-audio';
import { useTranslation } from '../contexts/I18nContext';
import { alertsGlobal } from '../contexts/AlertContext';

// Recording limit in seconds
const MAX_RECORDING_DURATION_SECONDS = 30;
const MAX_RECORDING_DURATION_MS = MAX_RECORDING_DURATION_SECONDS * 1000;

export interface AudioRecorderState {
    isRecording: boolean;
    isPreparing: boolean;
    isProcessing: boolean;
    duration: number; // in seconds
    error: string | null;
}

interface UseAudioRecorderReturn {
    state: AudioRecorderState;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<string | null>; // Returns URI or null
    cancelRecording: () => Promise<void>;
    remainingTime: number; // seconds remaining
    progress: number; // 0-1 progress
}

export function useAudioRecorder(): UseAudioRecorderReturn {
    const { t } = useTranslation();
    const [state, setState] = useState<AudioRecorderState>({
        isRecording: false,
        isPreparing: false,
        isProcessing: false,
        duration: 0,
        error: null,
    });

    const recorder = useExpoAudioRecorder(
        {
            ...RecordingPresets.HIGH_QUALITY,
            numberOfChannels: 1,
        }
    );

    const durationIntervalRef = useRef<number | null>(null);
    const autoStopTimeoutRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
            if (autoStopTimeoutRef.current) {
                clearTimeout(autoStopTimeoutRef.current);
            }
            try {
                if (recorder.isRecording) {
                    recorder.stop().catch(() => { });
                }
            } catch {
                // expo-audio native module not available (e.g. Expo Go)
            }
        };
    }, []);

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        try {
            const { status } = await requestRecordingPermissionsAsync();
            if (status !== 'granted') {
                void alertsGlobal.alert(
                    t('audioRecorder.permissionRequired'),
                    t('audioRecorder.micPermissionMessage')
                );
                return false;
            }
            return true;
        } catch (error) {
            if (__DEV__) console.error('Error requesting audio permissions:', error);
            return false;
        }
    }, []);

    const stopRecordingInternal = useCallback(async (): Promise<string | null> => {
        // Clear timers
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }
        if (autoStopTimeoutRef.current) {
            clearTimeout(autoStopTimeoutRef.current);
            autoStopTimeoutRef.current = null;
        }

        try {
            if (!recorder.isRecording) {
                setState(prev => ({ ...prev, isRecording: false, isProcessing: false }));
                return null;
            }
        } catch {
            setState(prev => ({ ...prev, isRecording: false, isProcessing: false }));
            return null;
        }

        setState(prev => ({ ...prev, isRecording: false, isProcessing: true }));

        try {
            await recorder.stop();

            // Reset audio mode
            await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
            });

            const uri = recorder.uri;

            setState(prev => ({ ...prev, isProcessing: false }));

            return uri;
        } catch (error: any) {
            if (__DEV__) console.error('Failed to stop recording:', error);
            setState(prev => ({
                ...prev,
                isRecording: false,
                isProcessing: false,
                error: error.message || t('audioRecorder.stopError'),
            }));
            return null;
        }
    }, [recorder]);

    const startRecording = useCallback(async () => {
        // Guard: prevent starting while already preparing or recording
        if (state.isPreparing || state.isRecording) return;

        try {
            // Reset state
            setState(prev => ({
                ...prev,
                isRecording: false,
                isPreparing: true,
                isProcessing: false,
                duration: 0,
                error: null,
            }));

            // Request permissions
            const hasPermission = await requestPermissions();
            if (!hasPermission) {
                setState(prev => ({ ...prev, isPreparing: false }));
                return;
            }

            // Configure audio mode
            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            // Small delay to ensure the OS has finished switching audio session
            await new Promise(resolve => setTimeout(resolve, 300));

            // Prepare and start recording
            await recorder.prepareToRecordAsync();
            recorder.record();

            startTimeRef.current = Date.now();

            setState(prev => ({
                ...prev,
                isRecording: true,
                isPreparing: false,
                duration: 0,
            }));

            // Set up duration tracking interval
            if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setState(prev => ({ ...prev, duration: Math.min(elapsed, MAX_RECORDING_DURATION_SECONDS) }));
            }, 100) as any;

            // Auto-stop after max duration
            if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current);
            autoStopTimeoutRef.current = setTimeout(async () => {
                await stopRecordingInternal();
            }, MAX_RECORDING_DURATION_MS) as any;

        } catch (error: any) {
            if (__DEV__) console.error('Failed to start recording:', error);
            setState(prev => ({
                ...prev,
                isRecording: false,
                isPreparing: false,
                error: error.message || t('audioRecorder.startError'),
            }));
        }
    }, [requestPermissions, state.isPreparing, state.isRecording, stopRecordingInternal]);

    const stopRecording = stopRecordingInternal;

    const cancelRecording = useCallback(async () => {
        // Clear timers
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }
        if (autoStopTimeoutRef.current) {
            clearTimeout(autoStopTimeoutRef.current);
            autoStopTimeoutRef.current = null;
        }

        try {
            if (recorder.isRecording) {
                await recorder.stop();
            }
        } catch {
            // Ignore errors when cancelling / native module unavailable
        }

        // Reset audio mode
        try {
            await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
            });
        } catch {
            // Ignore
        }

        setState({
            isRecording: false,
            isPreparing: false,
            isProcessing: false,
            duration: 0,
            error: null,
        });
    }, [recorder]);

    const remainingTime = Math.max(0, MAX_RECORDING_DURATION_SECONDS - state.duration);
    const progress = state.duration / MAX_RECORDING_DURATION_SECONDS;

    return {
        state,
        startRecording,
        stopRecording,
        cancelRecording,
        remainingTime,
        progress,
    };
}

export default useAudioRecorder;
