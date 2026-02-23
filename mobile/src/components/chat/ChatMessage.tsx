/**
 * ChatMessage Component
 * Renders a message bubble with support for:
 * - Clickable links
 * - Datetime proposals
 * - File attachments
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Platform,
  Pressable,
} from 'react-native';
import {
  Calendar as CalendarIcon,
  FileText,
  Image as ImageIcon,
  Plus,
} from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as ExpoCalendar from 'expo-calendar';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../contexts/I18nContext';
import { formatRelativeTime, formatDate, formatTime } from '../../utils/date';
import { formatNumberNoTrailingZeros } from '../../utils/number';
import { showToastGlobal } from '../ui';

interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface ChatMessageProps {
  content: string;
  isMe: boolean;
  senderName?: string;
  createdAt: string;
  proposedDatetime?: string;
  datetimeType?: 'INTERVIEW_PROPOSAL' | 'MEETING_REQUEST' | 'AVAILABILITY';
  attachments?: Attachment[];
}

// URL regex pattern
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

// Format file size
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumberNoTrailingZeros(bytes / 1024, 1)} KB`;
  return `${formatNumberNoTrailingZeros(bytes / (1024 * 1024), 1)} MB`;
};

// Get file icon based on type
const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return ImageIcon;
  return FileText;
};

// Truncate filename keeping extension
const truncateFilename = (name: string, maxLength: number = 20): string => {
  if (name.length <= maxLength) return name;
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
  const baseName = name.slice(0, name.length - ext.length);
  const truncatedBase = baseName.slice(0, maxLength - ext.length - 3);
  return `${truncatedBase}...${ext}`;
};

export function ChatMessage({
  content,
  isMe,
  senderName,
  createdAt,
  proposedDatetime,
  datetimeType,
  attachments = [],
}: ChatMessageProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const datetimeTypeLabels = {
    INTERVIEW_PROPOSAL: t('chat.datetimeTypes.interviewProposal'),
    MEETING_REQUEST: t('chat.datetimeTypes.meetingRequest'),
    AVAILABILITY: t('chat.datetimeTypes.availability'),
  };

  const handleLinkPress = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      if (__DEV__) console.error('Error opening link:', error);
    }
  };

  const handleAttachmentPress = async (attachment: Attachment) => {
    try {
      const url = attachment.url;

      // Check if it's a local file
      if (url.startsWith('file://')) {
        const fileInfo = await FileSystem.getInfoAsync(url);
        if (fileInfo.exists) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(url);
          }
        }
      } else {
        // Remote URL - open in browser
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        }
      }
    } catch (error) {
      if (__DEV__) console.error('Error opening attachment:', error);
    }
  };

  const handleAddToCalendar = async () => {
    if (!proposedDatetime) return;

    try {
      // Request calendar permission
      const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();

      if (status !== 'granted') {
        showToastGlobal({ type: 'warning', title: t('auth.createProfile.permissionRequired'), message: t('chat.calendarPermission') });
        return;
      }

      // Get default calendar
      const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(
        (cal) => cal.allowsModifications && (Platform.OS === 'ios' ? cal.source.name === 'iCloud' || cal.source.name === 'Default' : cal.isPrimary)
      ) || calendars.find((cal) => cal.allowsModifications);

      if (!defaultCalendar) {
        showToastGlobal({ type: 'error', title: t('common.error'), message: t('chat.noCalendar') });
        return;
      }

      const startDate = new Date(proposedDatetime);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
      const title = datetimeTypeLabels[datetimeType as keyof typeof datetimeTypeLabels] || t('chat.appointment');

      // Create event
      await ExpoCalendar.createEventAsync(defaultCalendar.id, {
        title,
        startDate,
        endDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      showToastGlobal({ type: 'success', title: t('common.success'), message: t('chat.eventAdded') });
    } catch (error) {
      if (__DEV__) console.error('Error adding to calendar:', error);
      showToastGlobal({ type: 'error', title: t('common.error'), message: t('chat.eventAddError') });
    }
  };

  // Parse content and render with clickable links
  const renderContent = () => {
    const parts = content.split(URL_REGEX);

    return (
      <Text style={[styles.messageText, { color: isMe ? colors.textOnPrimary : colors.textPrimary }]}>
        {parts.map((part, index) => {
          if (URL_REGEX.test(part)) {
            // Reset regex lastIndex
            URL_REGEX.lastIndex = 0;
            return (
              <Text
                key={index}
                style={[styles.linkText, { color: isMe ? colors.textOnPrimary : colors.primary }]}
                onPress={() => handleLinkPress(part)}
              >
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  return (
    <View
      style={[
        styles.messageBubble,
        isMe ? styles.myMessage : styles.theirMessage,
        { backgroundColor: isMe ? colors.primary : colors.gray100 },
      ]}
    >
      {/* Sender name (for received messages) */}
      {!isMe && senderName && (
        <Text style={[styles.senderName, { color: colors.gray600 }]}>
          {senderName}
        </Text>
      )}

      {/* Message content with clickable links */}
      {renderContent()}

      {/* Attachments */}
      {attachments && attachments.length > 0 && (
        <View style={styles.attachmentsContainer}>
          {attachments.map((attachment, index) => {
            const FileIcon = getFileIcon(attachment.type);
            return (
              <Pressable
                key={index}
                style={[
                  styles.attachmentItem,
                  { backgroundColor: isMe ? withOpacity(colors.white, OPACITY[20]) : colors.gray200 },
                ]}
                onPress={() => handleAttachmentPress(attachment)}
                accessibilityRole="button"
                accessibilityLabel={attachment.name}
              >
                <FileIcon
                  size={16}
                  color={isMe ? colors.textOnPrimary : colors.primary}
                  strokeWidth={ICON.strokeWidth}
                />
                <View style={styles.attachmentInfo}>
                  <Text
                    style={[styles.attachmentName, { color: isMe ? colors.textOnPrimary : colors.textPrimary }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {truncateFilename(attachment.name, 25)}
                  </Text>
                  <Text style={[styles.attachmentSize, { color: isMe ? withOpacity(colors.textOnPrimary, OPACITY[70]) : colors.gray500 }]}>
                    {formatFileSize(attachment.size)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Datetime proposal */}
      {proposedDatetime && (
        <Pressable
          style={[
            styles.datetimeProposal,
            { backgroundColor: isMe ? withOpacity(colors.white, OPACITY[20]) : withOpacity(colors.primary, OPACITY[15]) },
          ]}
          onPress={handleAddToCalendar}
          accessibilityRole="button"
          accessibilityLabel={t('chat.addToCalendar')}
        >
          <CalendarIcon
            size={16}
            color={isMe ? colors.textOnPrimary : colors.primary}
            strokeWidth={ICON.strokeWidth}
          />
          <View style={styles.datetimeInfo}>
            {datetimeType && (
              <Text style={[styles.datetimeLabel, { color: isMe ? withOpacity(colors.textOnPrimary, OPACITY[80]) : colors.primary }]}>
                {datetimeTypeLabels[datetimeType] || t('chat.proposedSlot')}
              </Text>
            )}
            <Text style={[styles.datetimeText, { color: isMe ? colors.textOnPrimary : colors.primary }]}>
              {formatDate(proposedDatetime)}{t('calendar.at')}{formatTime(proposedDatetime)}
            </Text>
          </View>
          <Plus
            size={16}
            color={isMe ? colors.textOnPrimary : colors.primary}
            strokeWidth={ICON.strokeWidth}
          />
        </Pressable>
      )}

      {/* Timestamp */}
      <Text
        style={[
          styles.messageTime,
          { color: isMe ? withOpacity(colors.textOnPrimary, OPACITY[70]) : colors.gray500 },
        ]}
      >
        {formatRelativeTime(createdAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  messageBubble: {
    minWidth: 120,
    maxWidth: '85%',
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.sm,
  },

  myMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },

  theirMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },

  senderName: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: 4,
  },

  messageText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },

  linkText: {
    textDecorationLine: 'underline',
  },

  // Attachments
  attachmentsContainer: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },

  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minWidth: 200,
    maxWidth: 300,
    padding: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  attachmentInfo: {
    flex: 1,
  },

  attachmentName: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  attachmentSize: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 1,
  },

  // Datetime proposal
  datetimeProposal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.md,
    minWidth: 260,
    maxWidth: 350,
  },

  datetimeInfo: {
    flex: 1,
  },

  datetimeLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: 2,
  },

  datetimeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  messageTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 4,
    textAlign: 'right',
  },
});
