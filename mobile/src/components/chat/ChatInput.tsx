/**
 * ChatInput Component
 * Handles message input with:
 * - File attachments (up to 20MB)
 * - Datetime picker (toggleable)
 * - Proper keyboard avoidance
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  SendHorizontal,
  Paperclip,
  Calendar,
  X,
  FileText,
  Image as ImageIcon,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../contexts/I18nContext';
import { getLocaleForLanguage } from '../../i18n';
import { formatNumberNoTrailingZeros } from '../../utils/number';
	import { formatDate, formatTime } from '../../utils/date';
	import { showToastGlobal } from '../ui';
	import { Button, IconButton, Input } from '../ui';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

interface Attachment {
  name: string;
  uri: string;
  type: string;
  size?: number;
}

interface ChatInputProps {
  onSend: (data: {
    content: string;
    attachments?: Attachment[];
    proposedDatetime?: string;
    datetimeType?: string;
  }) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  showDatetimeOption?: boolean;
}

// Format file size
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumberNoTrailingZeros(bytes / 1024, 1)} KB`;
  return `${formatNumberNoTrailingZeros(bytes / (1024 * 1024), 1)} MB`;
};

export function ChatInput({
  onSend,
  placeholder,
  disabled = false,
  isSending = false,
  showDatetimeOption = true,
}: ChatInputProps) {
  const { colors, isDark } = useTheme();
  const { t, language } = useTranslation();
  const locale = getLocaleForLanguage(language);
  const insets = useSafeAreaInsets();
  const inputRef = useRef<any>(null);

  const [messageText, setMessageText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [proposedDatetime, setProposedDatetime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Hide date picker when focusing text input
  const handleTextInputFocus = () => {
    if (showDatePicker) {
      setShowDatePicker(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // Check file size
        if (file.size && file.size > MAX_FILE_SIZE) {
          showToastGlobal({
            type: 'warning',
            title: t('common.fileTooLarge'),
            message: t('chat.fileSizeLimit', { size: formatFileSize(MAX_FILE_SIZE) }),
          });
          return;
        }

        // Check max attachments
        if (attachments.length >= 3) {
          showToastGlobal({ type: 'warning', title: t('common.limitReached'), message: t('chat.maxFiles') });
          return;
        }

        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            uri: file.uri,
            type: file.mimeType || 'application/octet-stream',
            size: file.size,
          },
        ]);
      }
    } catch (error) {
      if (__DEV__) console.error('Error picking file:', error);
      showToastGlobal({ type: 'error', title: t('common.error'), message: t('chat.fileSelectError') });
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleDatePicker = () => {
    Keyboard.dismiss();
    setShowDatePicker((prev) => !prev);
  };

  const handleDateChange = (_: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setProposedDatetime(date);
    }
  };

  const handleRemoveDatetime = () => {
    setProposedDatetime(null);
    setShowDatePicker(false);
  };

  const handleSend = async () => {
    const content = messageText.trim();
    if (!content && attachments.length === 0) return;

    try {
      await onSend({
        content,
        attachments: attachments.length > 0 ? attachments : undefined,
        proposedDatetime: proposedDatetime?.toISOString(),
        datetimeType: proposedDatetime ? 'MEETING_PROPOSAL' : undefined,
      });

      // Clear form
      setMessageText('');
      setAttachments([]);
      setProposedDatetime(null);
      setShowDatePicker(false);
    } catch (error) {
      // Error handled by parent
    }
  };

  const canSend = (messageText.trim() || attachments.length > 0) && !isSending && !disabled;

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    return FileText;
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.gray200,
          // Prevent the 3-button/gesture bar from overlapping the input when keyboard is hidden.
          paddingBottom: Math.max(SPACING.sm, insets.bottom),
        },
      ]}
    >
      {/* Datetime indicator */}
	      {proposedDatetime && (
	        <View style={[styles.datetimeIndicator, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
	          <Calendar size={16} color={colors.primary} strokeWidth={ICON.strokeWidth} />
	          <Text style={[styles.datetimeIndicatorText, { color: colors.primary }]}>
	            {t('chat.proposal', { date: formatDate(proposedDatetime.toISOString()), time: formatTime(proposedDatetime.toISOString()) })}
	          </Text>
	          <IconButton
	            onPress={handleRemoveDatetime}
	            icon={<X size={18} color={colors.gray500} strokeWidth={ICON.strokeWidth} />}
	            accessibilityLabel={t('common.remove')}
	            size="sm"
	            variant="ghost"
	            style={{ width: 28, height: 28 }}
	          />
	        </View>
	      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <View style={[styles.attachmentsPreview, { borderBottomColor: colors.gray200 }]}>
          {attachments.map((attachment, index) => {
            const FileIcon = getFileIcon(attachment.type);
            return (
              <View
                key={index}
                style={[styles.attachmentPreviewItem, { backgroundColor: colors.gray100 }]}
              >
                <FileIcon size={16} color={colors.primary} strokeWidth={ICON.strokeWidth} />
	                <View style={styles.attachmentPreviewInfo}>
	                  <Text style={[styles.attachmentPreviewName, { color: colors.textPrimary }]} numberOfLines={1}>
	                    {attachment.name}
	                  </Text>
	                  {attachment.size && (
	                    <Text style={[styles.attachmentPreviewSize, { color: colors.gray500 }]}>
	                      {formatFileSize(attachment.size)}
	                    </Text>
	                  )}
	                </View>
	                <IconButton
	                  onPress={() => handleRemoveAttachment(index)}
	                  icon={<X size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />}
	                  accessibilityLabel={t('common.remove')}
	                  size="sm"
	                  variant="ghost"
	                  style={{ width: 28, height: 28 }}
	                />
	              </View>
	            );
	          })}
	        </View>
	      )}

      {/* Date picker (iOS spinner) - background + textColor for visibility */}
      {showDatePicker && Platform.OS === 'ios' && (
        <View style={[styles.datePickerContainer, { borderBottomColor: colors.gray200, backgroundColor: colors.surface }]}>
	          <View style={styles.datePickerHeader}>
	            <Text style={[styles.datePickerTitle, { color: colors.textPrimary }]}>
	              {t('chat.proposeDate')}
	            </Text>
	            <Button
	              title={t('alert.ok')}
	              onPress={() => setShowDatePicker(false)}
	              variant="ghost"
	              size="sm"
	              style={{ paddingHorizontal: 0 }}
	              textStyle={[styles.datePickerDone, { color: colors.primary }]}
	            />
	          </View>
          <DateTimePicker
            value={proposedDatetime || new Date()}
            mode="datetime"
            display="spinner"
            onChange={handleDateChange}
            minimumDate={new Date()}
            locale={locale}
            themeVariant={isDark ? 'dark' : 'light'}
            textColor={colors.textPrimary}
          />
        </View>
      )}

      {/* Android date picker (modal) */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={proposedDatetime || new Date()}
          mode="datetime"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Input row */}
	      <View style={styles.inputRow}>
	        {/* Attachment button */}
	        <IconButton
	          onPress={handlePickFile}
	          disabled={disabled || attachments.length >= 3}
	          icon={
	            <Paperclip
	              size={20}
	              color={attachments.length >= 3 ? colors.gray400 : colors.gray600}
	              strokeWidth={ICON.strokeWidth}
	            />
	          }
	          accessibilityLabel={t('chat.addAttachment')}
	          size="sm"
	          variant="ghost"
	          style={[styles.iconButton, { backgroundColor: colors.gray100 }]}
	        />
	
	        {/* Datetime button */}
	        {showDatetimeOption && (
	          <IconButton
	            onPress={handleToggleDatePicker}
	            disabled={disabled}
	            icon={
	              <Calendar
	                size={20}
	                color={showDatePicker || proposedDatetime ? colors.primary : colors.gray600}
	                strokeWidth={ICON.strokeWidth}
	              />
	            }
	            accessibilityLabel={t('chat.proposeDate')}
	            size="sm"
	            variant="ghost"
	            style={[
	              styles.iconButton,
	              { backgroundColor: showDatePicker || proposedDatetime ? withOpacity(colors.primary, OPACITY[15]) : colors.gray100 },
	            ]}
	          />
	        )}

        {/* Text input */}
        <Input
          ref={inputRef}
          value={messageText}
          onChangeText={setMessageText}
          onFocus={handleTextInputFocus}
          placeholder={placeholder || t('chat.writeMessage')}
          multiline
          maxLength={2000}
          editable={!disabled}
          containerStyle={styles.textInputWrap}
          inputContainerStyle={[
            styles.textInputContainer,
            { backgroundColor: colors.gray100, borderColor: 'transparent' },
          ]}
          inputStyle={[styles.textInput, { color: colors.textPrimary }]}
        />

	        {/* Send button */}
	        <IconButton
	          onPress={handleSend}
	          disabled={!canSend}
	          icon={<SendHorizontal size={20} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
	          accessibilityLabel={t('chat.send')}
	          size="sm"
	          variant="ghost"
	          style={[styles.sendButton, { backgroundColor: canSend ? colors.primary : colors.gray300 }]}
	        />
	      </View>
	    </View>
	  );
	}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: BORDER.width.thin,
  },

  // Datetime indicator
  datetimeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },

  datetimeIndicatorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Attachments preview
  attachmentsPreview: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    borderBottomWidth: BORDER.width.thin,
  },

  attachmentPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  attachmentPreviewInfo: {
    flex: 1,
  },

  attachmentPreviewName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  attachmentPreviewSize: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 1,
  },

  // Date picker
  datePickerContainer: {
    borderBottomWidth: BORDER.width.thin,
    paddingBottom: SPACING.sm,
  },

  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },

  datePickerTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  datePickerDone: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    padding: SPACING.md,
  },

  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textInputWrap: {
    flex: 1,
  },

  textInputContainer: {
    height: undefined,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: BORDER.radius.md,
  },

  textInput: {
    height: undefined,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
