import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type TextInput as RNTextInput,
} from 'react-native';
import { Send, X } from 'lucide-react-native';
import { BORDER, OPACITY, SPACING, TYPOGRAPHY, withOpacity } from '../../constants/theme';
import { ActivityComment } from '../../types/activity';
import { IconButton, Input, ShimmerPlaceholder } from '../ui';

interface CommentComposerProps {
  colors: Record<string, string>;
  commentText: string;
  insets: { bottom: number };
  inputRef: React.RefObject<RNTextInput | null>;
  isInputFocused: boolean;
  isSubmittingRef: React.MutableRefObject<boolean>;
  replyingTo: ActivityComment | null;
  setCommentText: (value: string) => void;
  setIsInputFocused: (value: boolean) => void;
  submitting: boolean;
  t: (key: string, params?: Record<string, any>) => string;
  onCancelReply: () => void;
  onSubmit: () => void;
}

export function CommentComposer({
  colors,
  commentText,
  insets,
  inputRef,
  isInputFocused,
  isSubmittingRef,
  replyingTo,
  setCommentText,
  setIsInputFocused,
  submitting,
  t,
  onCancelReply,
  onSubmit,
}: CommentComposerProps) {
  const replyBlock = replyingTo ? (
    <View style={[styles.replyIndicator, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
      <View style={styles.replyContent}>
        <Text style={[styles.replyIndicatorText, { color: colors.primary }]} numberOfLines={1}>
          {t('community.comments.replyTo', { name: replyingTo.author?.display_name || '' })}
        </Text>
        <Text style={[styles.replyMessagePreview, { color: colors.textSecondary }]} numberOfLines={1}>
          {replyingTo.content}
        </Text>
      </View>
      <IconButton
        onPress={onCancelReply}
        icon={<X size={16} color={colors.primary} />}
        accessibilityLabel={t('common.cancel')}
        size="sm"
        variant="ghost"
        style={{ width: 28, height: 28 }}
      />
    </View>
  ) : null;

  return (
    <>
      {!isInputFocused ? (
        <View style={styles.inputSection}>
          {replyBlock}
          <Pressable
            style={[styles.inlineInputPill, { backgroundColor: colors.gray100 }]}
            onPress={() => {
              setIsInputFocused(true);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
          >
            <Text style={[styles.inputPlaceholder, { color: colors.gray400 }]}>
              {replyingTo ? t('community.comments.replyPlaceholder') : t('community.comments.addPlaceholder')}
            </Text>
            <View style={[styles.inlineSendButton, { backgroundColor: colors.gray300 }]}>
              <Send size={16} color={colors.textOnPrimary} />
            </View>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={isInputFocused}
        transparent
        animationType="none"
        onRequestClose={() => {
          Keyboard.dismiss();
          setIsInputFocused(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <Pressable
            style={[styles.modalBackdrop, { backgroundColor: colors.overlayLight }]}
            onPress={() => {
              Keyboard.dismiss();
              setIsInputFocused(false);
            }}
          />

          <View
            style={[
              styles.modalInputContainer,
              {
                backgroundColor: colors.surface,
                borderTopColor: withOpacity(colors.textPrimary, OPACITY[8]),
                paddingBottom: Math.max(SPACING.sm, insets.bottom),
              },
            ]}
          >
            {replyBlock}

            <View style={[styles.modalInputPill, { backgroundColor: colors.gray100 }]}>
              <Input
                ref={inputRef as any}
                value={commentText}
                onChangeText={setCommentText}
                placeholder={replyingTo ? t('community.comments.replyPlaceholder') : t('community.comments.addPlaceholder')}
                multiline
                maxLength={1000}
                autoFocus
                blurOnSubmit={false}
                containerStyle={{ flex: 1 }}
                inputContainerStyle={{
                  backgroundColor: 'transparent',
                  borderColor: 'transparent',
                  height: undefined,
                  minHeight: 44,
                  alignItems: 'flex-start',
                }}
                inputStyle={[styles.modalInput, { color: colors.textPrimary }]}
              />
              <IconButton
                onPress={() => {
                  if (!commentText.trim() || submitting) return;
                  isSubmittingRef.current = true;
                  onSubmit();
                }}
                disabled={!commentText.trim() || submitting}
                icon={
                  submitting ? (
                    <ShimmerPlaceholder width={20} height={14} variant="bar" />
                  ) : (
                    <Send size={16} color={colors.textOnPrimary} />
                  )
                }
                accessibilityLabel={t('chat.send')}
                size="sm"
                variant="ghost"
                style={[
                  styles.modalSendButton,
                  {
                    backgroundColor:
                      commentText.trim() && !submitting ? colors.primary : colors.gray300,
                  },
                ]}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = {
  inputSection: {
    paddingTop: SPACING.sm,
  },
  inlineInputPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderRadius: BORDER.radius.xl,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    paddingVertical: SPACING.xs,
    minHeight: 44,
  },
  inputPlaceholder: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    paddingVertical: SPACING.sm,
  },
  inlineSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end' as const,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalInputContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  modalInputPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: BORDER.radius.lg,
    paddingLeft: SPACING.sm,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 40,
  },
  modalInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    paddingTop: 0,
    paddingBottom: 0,
    paddingVertical: 8,
    maxHeight: 80,
    marginRight: SPACING.xs,
  },
  modalSendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  replyIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.xs,
  },
  replyContent: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  replyIndicatorText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold as any,
  },
  replyMessagePreview: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
};
