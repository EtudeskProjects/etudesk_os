import { FlatList, Image, Platform, Pressable, Text, View } from 'react-native';
import { AlertCircle, Paperclip, RefreshCw } from 'lucide-react-native';
import { ICON, OPACITY, withOpacity } from '../../constants/theme';
import { MessageSegment } from '../../services/copilotService';
import { Button } from '../ui';
import {
  AudioBlock,
  CopyButton,
  FeedbackButtons,
  MarkdownRenderer,
  ThinkingIndicator,
  ToolBlock,
  VoiceNotePlayer,
} from '../copilot';

interface AttachmentInfo {
  name: string;
  type: string;
  size?: number;
  uri?: string;
}

interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  segments: MessageSegment[];
  attachments?: AttachmentInfo[];
  senderName?: string;
  isStreaming?: boolean;
  error?: string;
  lastUserMessage?: string;
  voiceNoteUrl?: string;
}

interface AssistantMessagesListProps {
  buildFollowUps: (content: string) => string[];
  colors: {
    borderColor: string;
    error: string;
    primary: string;
    textDisabled: string;
    textOnPrimary: string;
    textSecondary: string;
  };
  formatAssistantError: (value: string) => string;
  formatTimestamp: (messageId: string) => string;
  handleQuizAnswer: (answer: string) => void;
  handleRetry: (messageId: string) => void;
  handleSelectFollowUp: (value: string) => void;
  handleUserMessageLongPress: (id: string, content: string) => void;
  onSkillPress?: (name: string) => void;
  hasClearNextStep: (content: string) => boolean;
  isOrganizationSpace: boolean;
  isSending: boolean;
  latestAssistantId?: string | null;
  messages: StreamingMessage[];
  messagesListRef: React.RefObject<FlatList<StreamingMessage> | null>;
  sessionId: string | null;
  styles: Record<string, any>;
  t: (key: string) => string;
}

export function AssistantMessagesList({
  buildFollowUps,
  colors,
  formatAssistantError,
  formatTimestamp,
  handleQuizAnswer,
  handleRetry,
  handleSelectFollowUp,
  onSkillPress,
  handleUserMessageLongPress,
  hasClearNextStep,
  isOrganizationSpace,
  isSending,
  latestAssistantId,
  messages,
  messagesListRef,
  sessionId,
  styles,
  t,
}: AssistantMessagesListProps) {
  return (
    <FlatList
      ref={messagesListRef}
      style={styles.messagesContainer}
      contentContainerStyle={styles.messagesContent}
      data={messages}
      keyExtractor={(message) => message.id}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      initialNumToRender={12}
      windowSize={11}
      removeClippedSubviews={Platform.OS === 'android'}
      renderItem={({ item: message, index: messageIndex }) => (
        <View style={styles.messageWrapper}>
          {message.role === 'user' ? (
            <View style={styles.userMessageContainer}>
              {message.senderName && isOrganizationSpace ? (
                <Text style={[styles.senderLabel, { color: colors.textSecondary }]}>
                  {message.senderName}
                </Text>
              ) : null}
              <Pressable
                style={({ pressed }) => [
                  styles.userMessage,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.9 },
                ]}
                onLongPress={() => handleUserMessageLongPress(message.id, message.content)}
                delayLongPress={400}
              >
                {message.voiceNoteUrl ? <VoiceNotePlayer url={message.voiceNoteUrl} /> : null}
                {message.content &&
                !(message.voiceNoteUrl && message.content === `🎤 ${t('screens.assistant.voiceNote')}`) ? (
                  <Text style={[styles.userMessageText, { color: colors.textOnPrimary }]}>
                    {message.content}
                  </Text>
                ) : null}
                {message.attachments && message.attachments.length > 0 ? (
                  <View style={[styles.userAttachments, message.content ? { marginTop: 6 } : undefined]}>
                    {message.attachments.map((attachment, index) => {
                      const isImage = attachment.type?.startsWith('image/') && attachment.uri;
                      return isImage ? (
                        <Image
                          key={index}
                          source={{ uri: attachment.uri }}
                          style={[
                            styles.userMsgThumb,
                            { borderColor: withOpacity(colors.textOnPrimary, OPACITY[30]) },
                          ]}
                        />
                      ) : (
                        <View
                          key={index}
                          style={[
                            styles.userAttachmentChip,
                            { backgroundColor: withOpacity(colors.textOnPrimary, OPACITY[20]) },
                          ]}
                        >
                          <Paperclip
                            size={10}
                            color={colors.textOnPrimary}
                            strokeWidth={ICON.strokeWidth}
                          />
                          <Text
                            style={[styles.userAttachmentText, { color: colors.textOnPrimary }]}
                            numberOfLines={1}
                          >
                            {attachment.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </Pressable>
            </View>
          ) : (
            <View style={styles.assistantMessage}>
              {message.segments.length > 0 ? (
                <>
                  {message.segments.map((segment, index) => {
                    if (segment.type === 'tool' && segment.tool) {
                      return <ToolBlock key={`segment-${index}`} tool={segment.tool} />;
                    }
                    if (segment.type === 'text' && segment.content) {
                      const isLastMessage =
                        messageIndex === messages.length - 1 && !message.isStreaming && !isSending;
                      return (
                        <MarkdownRenderer
                          key={`segment-${index}`}
                          content={segment.content}
                          onQuizAnswer={isLastMessage ? handleQuizAnswer : undefined}
                          onSkillPress={onSkillPress}
                          sessionId={sessionId || undefined}
                          interactiveConfirmation={!message.isStreaming}
                        />
                      );
                    }
                    if (segment.type === 'audio' && segment.audioUrl) {
                      const audioSegment = segment as MessageSegment & { autoPlay?: boolean };
                      return (
                        <AudioBlock
                          key={`segment-${index}`}
                          url={segment.audioUrl}
                          duration={segment.audioDuration}
                          autoPlay={!!audioSegment.autoPlay}
                        />
                      );
                    }
                    if (segment.type === 'status' && segment.label) {
                      return <ThinkingIndicator key={`segment-${index}`} label={segment.label} />;
                    }
                    return null;
                  })}
                </>
              ) : message.isStreaming ? (
                <ThinkingIndicator />
              ) : null}

              {message.error ? (
                <View
                  style={[
                    styles.messageError,
                    { backgroundColor: withOpacity(colors.error, OPACITY[5]) },
                  ]}
                >
                  <AlertCircle size={14} color={colors.error} />
                  <Text style={[styles.messageErrorText, { color: colors.error }]}>
                    {formatAssistantError(message.error)}
                  </Text>
                  {message.lastUserMessage ? (
                    <Button
                      title={t('screens.assistant.retry')}
                      onPress={() => handleRetry(message.id)}
                      variant="outline"
                      size="sm"
                      icon={<RefreshCw size={12} color={colors.error} />}
                      style={[styles.retryButton, { borderColor: colors.error }]}
                      textStyle={[styles.retryText, { color: colors.error }]}
                    />
                  ) : null}
                </View>
              ) : null}

              {message.isStreaming && message.content ? (
                <View style={styles.streamingCursor}>
                  <View style={[styles.cursorDot, { backgroundColor: colors.primary }]} />
                </View>
              ) : null}

              {message.content && !message.isStreaming && !message.error ? (
                <View style={styles.messageFooter}>
                  <Text style={[styles.messageTimestamp, { color: colors.textDisabled }]}>
                    {formatTimestamp(message.id)}
                  </Text>
                  <View style={styles.messageActions}>
                    <FeedbackButtons messageId={message.id} />
                    <CopyButton content={message.content} />
                  </View>
                </View>
              ) : null}

              {message.content &&
              !message.isStreaming &&
              !message.error &&
              message.id === latestAssistantId &&
              !hasClearNextStep(message.content) ? (
                <View style={styles.followUpsWrap}>
                  {buildFollowUps(message.content)
                    .slice(0, 3)
                    .map((followUp, index) => (
                      <Pressable
                        key={`${message.id}-followup-${index}`}
                        onPress={() => handleSelectFollowUp(followUp)}
                        style={({ pressed }) => [
                          styles.followUpChip,
                          {
                            borderColor: colors.borderColor,
                            backgroundColor: withOpacity(colors.primary, OPACITY[5]),
                          },
                          pressed && {
                            backgroundColor: withOpacity(colors.primary, OPACITY[12]),
                          },
                        ]}
                      >
                        <Text
                          style={[styles.followUpText, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {followUp}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              ) : null}
            </View>
          )}
        </View>
      )}
    />
  );
}
