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
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
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
import { formatDate, formatTime } from '../../utils/date';

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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function ChatInput({
  onSend,
  placeholder = 'Écrivez votre message...',
  disabled = false,
  isSending = false,
  showDatetimeOption = true,
}: ChatInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

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
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // Check file size
        if (file.size && file.size > MAX_FILE_SIZE) {
          Alert.alert(
            'Fichier trop volumineux',
            `Le fichier ne doit pas dépasser ${formatFileSize(MAX_FILE_SIZE)}.`
          );
          return;
        }

        // Check max attachments
        if (attachments.length >= 3) {
          Alert.alert('Limite atteinte', 'Vous pouvez joindre maximum 3 fichiers.');
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
      console.error('Error picking file:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier.');
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
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.gray200 }]}>
      {/* Datetime indicator */}
      {proposedDatetime && (
        <View style={[styles.datetimeIndicator, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
          <Calendar size={16} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.datetimeIndicatorText, { color: colors.primary }]}>
            Proposition: {formatDate(proposedDatetime.toISOString())} à {formatTime(proposedDatetime.toISOString())}
          </Text>
          <TouchableOpacity onPress={handleRemoveDatetime} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={18} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
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
                <TouchableOpacity
                  onPress={() => handleRemoveAttachment(index)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Date picker (iOS spinner) */}
      {showDatePicker && Platform.OS === 'ios' && (
        <View style={[styles.datePickerContainer, { borderBottomColor: colors.gray200 }]}>
          <View style={styles.datePickerHeader}>
            <Text style={[styles.datePickerTitle, { color: colors.textPrimary }]}>
              Proposer une date
            </Text>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <Text style={[styles.datePickerDone, { color: colors.primary }]}>OK</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={proposedDatetime || new Date()}
            mode="datetime"
            display="spinner"
            onChange={handleDateChange}
            minimumDate={new Date()}
            locale="fr-FR"
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
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.gray100 }]}
          onPress={handlePickFile}
          disabled={disabled || attachments.length >= 3}
        >
          <Paperclip
            size={20}
            color={attachments.length >= 3 ? colors.gray400 : colors.gray600}
            strokeWidth={ICON.strokeWidth}
          />
        </TouchableOpacity>

        {/* Datetime button */}
        {showDatetimeOption && (
          <TouchableOpacity
            style={[
              styles.iconButton,
              { backgroundColor: showDatePicker || proposedDatetime ? withOpacity(colors.primary, OPACITY[15]) : colors.gray100 },
            ]}
            onPress={handleToggleDatePicker}
            disabled={disabled}
          >
            <Calendar
              size={20}
              color={showDatePicker || proposedDatetime ? colors.primary : colors.gray600}
              strokeWidth={ICON.strokeWidth}
            />
          </TouchableOpacity>
        )}

        {/* Text input */}
        <TextInput
          ref={inputRef}
          style={[styles.textInput, { backgroundColor: colors.gray100, color: colors.textPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={colors.gray500}
          value={messageText}
          onChangeText={setMessageText}
          onFocus={handleTextInputFocus}
          multiline
          maxLength={2000}
          editable={!disabled}
        />

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: canSend ? colors.primary : colors.gray300 }]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <SendHorizontal size={20} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
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

  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.md,
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
