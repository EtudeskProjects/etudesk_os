import { Animated, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Mic, MicOff, Pause, Play, Plus, SendHorizontal, Square, X } from 'lucide-react-native';
import { BORDER, ICON, OPACITY, TYPOGRAPHY, withOpacity } from '../../constants/theme';
import { Button, IconButton, Input } from '../ui';

type Mode = 'explore' | 'study';

interface AssistantComposerProps {
  activeMode: Mode;
  attachments: { name: string; uri: string; type: string; size?: number }[];
  audioRecorder: any;
  colors: Record<string, string>;
  currentModeLabel: string;
  formatDuration: (seconds: number) => string;
  floatingSuggestions: string[];
  handleMicPress: () => Promise<void>;
  handlePickFile: () => Promise<void>;
  handleSend: () => Promise<void>;
  handleStop: () => void;
  inputRef: any;
  inputText: string;
  isSending: boolean;
  isTranscribing: boolean;
  modeColors: Record<Mode, { bg: string; text: string }>;
  modeIcon: React.ReactNode;
  modesCount: number;
  onChangeText: (value: string) => void;
  onRemoveAttachment: (index: number) => void;
  onSelectSuggestion: (value: string) => void;
  onToggleMode: () => void;
  pendingVoiceNote: { uri: string; duration: number } | null;
  recordingPulse: Animated.Value;
  removePendingVoiceNote: () => void;
  shouldShowFloatingSuggestions: boolean;
  styles: Record<string, any>;
  t: (key: string) => string;
  voicePreviewPlayer: any;
}

export function AssistantComposer({
  activeMode,
  attachments,
  audioRecorder,
  colors,
  currentModeLabel,
  floatingSuggestions,
  formatDuration,
  handleMicPress,
  handlePickFile,
  handleSend,
  handleStop,
  inputRef,
  inputText,
  isSending,
  isTranscribing,
  modeColors,
  modeIcon,
  modesCount,
  onChangeText,
  onRemoveAttachment,
  onSelectSuggestion,
  onToggleMode,
  pendingVoiceNote,
  recordingPulse,
  removePendingVoiceNote,
  shouldShowFloatingSuggestions,
  styles,
  t,
  voicePreviewPlayer,
}: AssistantComposerProps) {
  return (
    <View style={styles.inputArea}>
      {shouldShowFloatingSuggestions ? (
        <View style={styles.floatingSuggestionsWrap}>
          {floatingSuggestions.slice(0, 3).map((suggestion, index) => (
            <Pressable
              key={`floating-suggestion-${index}`}
              onPress={() => onSelectSuggestion(suggestion)}
              style={({ pressed }) => [
                styles.floatingSuggestionChip,
                {
                  borderColor: colors.borderColor,
                  backgroundColor: withOpacity(colors.background, OPACITY[90]),
                },
                pressed && {
                  backgroundColor: withOpacity(colors.primary, OPACITY[8]),
                  borderColor: withOpacity(colors.primary, OPACITY[30]),
                },
              ]}
            >
              <Text
                style={[styles.floatingSuggestionText, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {suggestion}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          { backgroundColor: colors.surface, borderColor: colors.borderColor },
        ]}
      >
        {(audioRecorder.state.isRecording ||
          audioRecorder.state.isPreparing ||
          isTranscribing) && (
          <View
            style={[
              styles.recordingOverlay,
              { backgroundColor: withOpacity(colors.error, OPACITY[10]) },
            ]}
          >
            <View style={styles.recordingContent}>
              {isTranscribing ? (
                <>
                  <View
                    style={[
                      styles.recordingDot,
                      { backgroundColor: withOpacity(colors.textSecondary, OPACITY[40]) },
                    ]}
                  />
                  <Text style={[styles.recordingText, { color: colors.textPrimary }]}>
                    {t('screens.assistant.processingVoiceNote')}
                  </Text>
                </>
              ) : audioRecorder.state.isPreparing ? (
                <>
                  <View style={[styles.recordingDot, { backgroundColor: colors.warning }]} />
                  <Text style={[styles.recordingText, { color: colors.textPrimary }]}>
                    {t('screens.assistant.preparing')}
                  </Text>
                </>
              ) : (
                <>
                  <Animated.View
                    style={[
                      styles.recordingDot,
                      {
                        backgroundColor: colors.error,
                        opacity: recordingPulse,
                        transform: [
                          {
                            scale: recordingPulse.interpolate({
                              inputRange: [0.3, 1],
                              outputRange: [0.8, 1.2],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  <Text style={[styles.recordingText, { color: colors.textPrimary }]}>
                    {formatDuration(audioRecorder.state.duration)} / 3:00
                  </Text>
                  <View
                    style={[
                      styles.recordingProgress,
                      { backgroundColor: withOpacity(colors.black, OPACITY[10]) },
                    ]}
                  >
                    <View
                      style={[
                        styles.recordingProgressBar,
                        {
                          backgroundColor: colors.error,
                          width: `${audioRecorder.progress * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {attachments.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.attachmentPreviewContainer}
          >
            {attachments.map((file, index) => {
              const isImage = file.type?.startsWith('image/');
              return isImage ? (
                <View key={index} style={styles.attachmentThumbWrap}>
                  <Image
                    source={{ uri: file.uri }}
                    style={[styles.attachmentThumb, { borderColor: colors.borderColor }]}
                  />
                  <Pressable
                    onPress={() => onRemoveAttachment(index)}
                    style={[
                      styles.attachmentThumbRemove,
                      { backgroundColor: colors.primary },
                    ]}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <X size={8} color={colors.textOnPrimary} strokeWidth={3} />
                  </Pressable>
                </View>
              ) : (
                <View
                  key={index}
                  style={[
                    styles.attachmentPreview,
                    {
                      backgroundColor: withOpacity(colors.primary, OPACITY[10]),
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <View style={styles.attachmentPreviewContent}>
                    <Text
                      style={[styles.attachmentPreviewText, { color: colors.primary }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {file.name}
                    </Text>
                  </View>
                  <IconButton
                    onPress={() => onRemoveAttachment(index)}
                    icon={
                      <X
                        size={10}
                        color={colors.textOnPrimary}
                        strokeWidth={ICON.strokeWidth}
                      />
                    }
                    accessibilityLabel={t('screens.assistant.removeAttachment')}
                    size="sm"
                    variant="ghost"
                    style={[
                      styles.removeAttachmentButton,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        {pendingVoiceNote && !audioRecorder.state.isRecording && !isTranscribing ? (
          <View
            style={[
              styles.voiceNotePreview,
              {
                backgroundColor: withOpacity(colors.primary, OPACITY[10]),
                borderColor: withOpacity(colors.primary, OPACITY[30]),
              },
            ]}
          >
            <Pressable
              onPress={() =>
                voicePreviewPlayer.state.isPlaying
                  ? voicePreviewPlayer.pause()
                  : voicePreviewPlayer.play()
              }
              style={[styles.voiceNotePlayBtn, { backgroundColor: colors.primary }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {voicePreviewPlayer.state.isPlaying ? (
                <Pause
                  size={12}
                  color={colors.textOnPrimary}
                  fill={colors.textOnPrimary}
                />
              ) : (
                <Play
                  size={12}
                  color={colors.textOnPrimary}
                  fill={colors.textOnPrimary}
                />
              )}
            </Pressable>
            <View style={styles.voiceNoteProgressWrap}>
              <View
                style={[
                  styles.voiceNoteProgressBg,
                  { backgroundColor: withOpacity(colors.primary, OPACITY[20]) },
                ]}
              >
                <View
                  style={[
                    styles.voiceNoteProgressBar,
                    {
                      backgroundColor: colors.primary,
                      width: `${(voicePreviewPlayer.state.progress || 0) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={[styles.voiceNoteDuration, { color: colors.primary }]}>
              {formatDuration(
                voicePreviewPlayer.state.isPlaying
                  ? Math.round(voicePreviewPlayer.state.currentTime)
                  : pendingVoiceNote.duration
              )}
            </Text>
            <Pressable
              onPress={removePendingVoiceNote}
              style={[
                styles.voiceNoteRemoveBtn,
                { backgroundColor: withOpacity(colors.textSecondary, OPACITY[20]) },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <X size={10} color={colors.textSecondary} strokeWidth={3} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <Input
            ref={inputRef}
            placeholder={
              audioRecorder.state.isRecording
                ? t('screens.assistant.recording')
                : t('assistant.inputPlaceholder')
            }
            value={inputText}
            onChangeText={onChangeText}
            multiline
            maxLength={2000}
            editable={
              !isSending &&
              !audioRecorder.state.isRecording &&
              !isTranscribing &&
              !audioRecorder.state.isPreparing
            }
            containerStyle={{ flex: 1 }}
            inputContainerStyle={{
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              borderWidth: 0,
              height: undefined,
              minHeight: 32,
              maxHeight: 100,
              paddingVertical: 0,
            }}
            inputStyle={{
              color: colors.textPrimary,
              paddingHorizontal: 0,
              paddingVertical: 4,
              fontSize: TYPOGRAPHY.fontSize.md,
              minHeight: 32,
              maxHeight: 100,
            }}
          />
        </View>

        <View style={styles.actionsRow}>
          <IconButton
            onPress={handlePickFile}
            disabled={isSending || audioRecorder.state.isRecording || isTranscribing}
            icon={
              <Plus
                size={ICON.size.md}
                color={
                  isSending || audioRecorder.state.isRecording || isTranscribing
                    ? colors.gray300
                    : colors.gray500
                }
                strokeWidth={ICON.strokeWidth}
              />
            }
            accessibilityLabel={t('screens.assistant.addAttachment')}
            size="sm"
            variant="ghost"
            style={styles.inputAction}
          />

          <Button
            title={currentModeLabel}
            onPress={onToggleMode}
            disabled={modesCount === 1}
            variant="secondary"
            size="sm"
            icon={modeIcon}
            style={[
              styles.modeToggle,
              { backgroundColor: modeColors[activeMode].bg, borderRadius: BORDER.radius.full },
            ]}
            textStyle={[styles.modeToggleText, { color: modeColors[activeMode].text }]}
          />

          <View style={{ flex: 1 }} />

          <IconButton
            onPress={handleMicPress}
            disabled={
              isSending ||
              audioRecorder.state.isPreparing ||
              isTranscribing ||
              !!pendingVoiceNote
            }
            icon={
              audioRecorder.state.isRecording ? (
                <MicOff size={ICON.size.md} color={colors.error} strokeWidth={ICON.strokeWidth} />
              ) : (
                <Mic
                  size={ICON.size.md}
                  color={
                    isSending || isTranscribing || pendingVoiceNote
                      ? colors.gray300
                      : colors.gray500
                  }
                  strokeWidth={ICON.strokeWidth}
                />
              )
            }
            accessibilityLabel={
              audioRecorder.state.isRecording
                ? t('screens.assistant.stopRecording')
                : t('screens.assistant.startRecording')
            }
            size="sm"
            variant="ghost"
            style={[
              styles.inputAction,
              audioRecorder.state.isRecording && styles.micButtonRecording,
              audioRecorder.state.isRecording && {
                backgroundColor: withOpacity(colors.error, OPACITY[20]),
              },
            ]}
          />

          <IconButton
            onPress={isSending ? handleStop : handleSend}
            disabled={
              !isSending &&
              ((!inputText.trim() && attachments.length === 0 && !pendingVoiceNote) ||
                audioRecorder.state.isRecording)
            }
            icon={
              isSending ? (
                <Square
                  size={ICON.size.sm}
                  color={colors.textOnPrimary}
                  fill={colors.textOnPrimary}
                  strokeWidth={0}
                />
              ) : (
                <SendHorizontal
                  size={ICON.size.md}
                  color={
                    (inputText.trim() || attachments.length > 0 || pendingVoiceNote) &&
                    !audioRecorder.state.isRecording
                      ? colors.textOnPrimary
                      : colors.gray400
                  }
                  strokeWidth={ICON.strokeWidth}
                />
              )
            }
            accessibilityLabel={
              isSending ? t('screens.assistant.stopGeneration') : t('screens.assistant.send')
            }
            size="sm"
            variant="ghost"
            style={[
              styles.sendButton,
              isSending
                ? { backgroundColor: colors.textPrimary }
                : { backgroundColor: colors.primary },
              !isSending &&
                ((!inputText.trim() && attachments.length === 0 && !pendingVoiceNote) ||
                  audioRecorder.state.isRecording) && { backgroundColor: colors.gray200 },
            ]}
          />
        </View>
      </View>
    </View>
  );
}
