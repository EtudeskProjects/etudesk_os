/**
 * useAudioRecorder Hook
 * Manages audio recording with expo-av, limited to 30 seconds
 * Designed for voice-to-text input in the Copilot
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { Platform, Alert } from 'react-native';

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
    const [state, setState] = useState<AudioRecorderState>({
        isRecording: false,
        isPreparing: false,
        isProcessing: false,
        duration: 0,
        error: null,
    });

    const recordingRef = useRef<Audio.Recording | null>(null);
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
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(() => { });
            }
        };
    }, []);

    const requestPermissions = useCallback(async (): Promise<boolean> => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission requise',
                    'L\'accès au microphone est nécessaire pour enregistrer votre voix.',
                    [{ text: 'OK' }]
                );
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error requesting audio permissions:', error);
            return false;
        }
    }, []);

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

            // 1. Unload any previous recording session completely
            if (recordingRef.current) {
                try {
                    await recordingRef.current.stopAndUnloadAsync();
                } catch (e) {
                    // Ignore
                } finally {
                    recordingRef.current = null;
                }
            }

            // 2. Configure audio mode and WAIT for it to be applied
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // Small delay to ensure the OS has finished switching audio session
            // This is critical on many Android devices
            await new Promise(resolve => setTimeout(resolve, 300));

            // 3. Create NEW recording instance
            const recording = new Audio.Recording();

            // Set status update callback
            recording.setOnRecordingStatusUpdate((status) => {
                if (status.isRecording && status.durationMillis) {
                    const durationSeconds = Math.floor(status.durationMillis / 1000);
                    setState(prev => ({ ...prev, duration: durationSeconds }));
                }
            });

            // 4. Prepare with SAFEST settings (standard sample rate)
            // Some devices fail with 16000Hz, 44100Hz is universally supported
            await recording.prepareToRecordAsync({
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                    sampleRate: 44100,
                    numberOfChannels: 1,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.m4a',
                    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
                    audioQuality: Audio.IOSAudioQuality.HIGH,
                    sampleRate: 44100,
                    numberOfChannels: 1,
                    bitRate: 128000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                },
            });

            // 5. Start recording only after successful preparation
            await recording.startAsync();

            recordingRef.current = recording;
            startTimeRef.current = Date.now();

            setState(prev => ({
                ...prev,
                isRecording: true,
                isPreparing: false,
                duration: 0,
            }));

            // Set up duration tracking interval as backup
            if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setState(prev => ({ ...prev, duration: Math.min(elapsed, MAX_RECORDING_DURATION_SECONDS) }));
            }, 100) as any;

            // Auto-stop after max duration
            if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current);
            autoStopTimeoutRef.current = setTimeout(async () => {
                await stopRecording();
            }, MAX_RECORDING_DURATION_MS) as any;

        } catch (error: any) {
            console.error('Failed to start recording:', error);
            setState(prev => ({
                ...prev,
                isRecording: false,
                isPreparing: false,
                error: error.message || 'Impossible de démarrer l\'enregistrement',
            }));
        }
    }, [requestPermissions, state.isPreparing, state.isRecording]);

    const stopRecording = useCallback(async (): Promise<string | null> => {
        // Clear timers
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }
        if (autoStopTimeoutRef.current) {
            clearTimeout(autoStopTimeoutRef.current);
            autoStopTimeoutRef.current = null;
        }

        if (!recordingRef.current) {
            setState(prev => ({ ...prev, isRecording: false, isProcessing: false }));
            return null;
        }

        setState(prev => ({ ...prev, isRecording: false, isProcessing: true }));

        try {
            const recording = recordingRef.current;
            await recording.stopAndUnloadAsync();

            // Reset audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });

            const uri = recording.getURI();
            recordingRef.current = null;

            setState(prev => ({ ...prev, isProcessing: false }));

            return uri;
        } catch (error: any) {
            console.error('Failed to stop recording:', error);
            recordingRef.current = null;
            setState(prev => ({
                ...prev,
                isRecording: false,
                isProcessing: false,
                error: error.message || 'Erreur lors de l\'arrêt de l\'enregistrement',
            }));
            return null;
        }
    }, []);

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

        if (recordingRef.current) {
            try {
                await recordingRef.current.stopAndUnloadAsync();
            } catch {
                // Ignore errors when cancelling
            }
            recordingRef.current = null;
        }

        // Reset audio mode
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
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
    }, []);

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
