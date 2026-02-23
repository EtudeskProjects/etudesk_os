/**
 * Community Invitations Management Page
 * Shows pending invitations and allows adding new ones
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  UserPlus,
  Clock,
  Mail,
  Trash2,
  Send,
  Inbox,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../../src/constants/theme';
import { Button, IconButton, PageLayout, EmptyState, Input, KeyboardAwareScrollView, Tap } from '../../../../../src/components/ui';
import { FormTextArea } from '../../../../../src/components/forms/FormTextArea';
import { useTheme } from '../../../../../src/hooks/useTheme';
import { communityService, communityInvitationService, CommunityInvitation } from '../../../../../src/services';
import { formatRelativeTime } from '../../../../../src/utils/date';
import type { Community } from '../../../../../src/types/models';
import { useAlert } from '../../../../../src/contexts/AlertContext';
import { useI18n } from '../../../../../src/contexts/I18nContext';

// Status config - colors will be resolved dynamically in the component
const STATUS_CONFIG = {
  PENDING: { icon: Clock, label: 'gestion.invitations.pending' },
};

export default function CommunityInvitationsScreen() {
  const { id: communityId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const [community, setCommunity] = useState<Community | null>(null);
  const [invitations, setInvitations] = useState<CommunityInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const alerts = useAlert();

  useEffect(() => {
    loadData();
  }, [communityId]);

  const loadData = async () => {
    if (!communityId) return;

    setIsLoading(true);
    try {
      const [communityResponse, invitationsResponse] = await Promise.all([
        communityService.getById(communityId),
        communityInvitationService.getCommunityInvitations(communityId, { status: 'PENDING' }),
      ]);

      setCommunity(communityResponse.data);
      // Backend returns { data: [...invitations], count, statusCounts }
      // invitationsResponse.data is the array of invitations
      const invitationsData = (invitationsResponse as any)?.data || [];
      const pendingInvitations = invitationsData.filter(
        (inv: CommunityInvitation) => inv.status === 'PENDING'
      );
      if (__DEV__) console.log('Invitations loaded:', invitationsData.length, 'Pending:', pendingInvitations.length);
      setInvitations(pendingInvitations);
    } catch (error) {
      if (__DEV__) console.error('Error loading data:', error);
      void alerts.alert(t('common.error'), t('gestion.invitations.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData().finally(() => setIsRefreshing(false));
  }, [communityId]);

  const handleCancelInvitation = (invitation: CommunityInvitation) => {
    void alerts.showAlert({ title: t('gestion.invitations.cancelInvitation'), message: t('gestion.invitations.cancelInvitationMessage', { email: invitation.invitee_email }), buttons: [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('gestion.invitations.cancelYes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await communityInvitationService.cancelInvitation(communityId!, invitation.id);
              handleRefresh();
              void alerts.alert(t('common.success'), t('gestion.invitations.cancelSuccess'));
            } catch (error: any) {
              void alerts.alert(t('common.error'), error?.error || t('gestion.invitations.cancelError'));
            }
          },
        },
      ] });
  };

  const handleResendInvitation = async (invitation: CommunityInvitation) => {
    try {
      await communityInvitationService.resendInvitation(communityId!, invitation.id);
      void alerts.alert(t('common.success'), t('gestion.invitations.resentTo', { email: invitation.invitee_email }));
    } catch (error: any) {
      void alerts.alert(t('common.error'), error?.error || t('gestion.invitations.resendError'));
    }
  };

  const handleSendInvite = async () => {
    if (!communityId) return;

    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      void alerts.alert(t('common.error'), t('gestion.invitations.invalidEmail'));
      return;
    }

    setIsSendingInvite(true);
    try {
      const response = await communityInvitationService.sendInvitations(communityId, [
        { email, message: inviteMessage.trim() || undefined }
      ]);

      if (response.data?.sent > 0) {
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteMessage('');
        handleRefresh();
        void alerts.alert(t('gestion.invitations.sentTitle'), t('gestion.invitations.sentTo', { email }));
      } else if (response.data?.errors?.length > 0) {
        void alerts.alert(t('common.error'), response.data.errors[0]?.error || t('gestion.invitations.sendError'));
      }
    } catch (error: any) {
      void alerts.alert(t('common.error'), error?.error || t('gestion.invitations.sendError'));
    } finally {
      setIsSendingInvite(false);
    }
  };

  const renderInvitationItem = ({ item }: { item: CommunityInvitation }) => {
    const statusConfig = STATUS_CONFIG.PENDING;
    const StatusIcon = statusConfig.icon;
    const statusColor = colors.warning; // PENDING status uses warning color

    return (
      <View style={[styles.invitationCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
        <View style={styles.invitationHeader}>
          <View style={[styles.iconContainer, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
            <Mail size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
          </View>

          <View style={styles.invitationInfo}>
            <Text style={[styles.inviteeEmail, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.invitee_email}
            </Text>
            {item.invitee_name && (
              <Text style={[styles.inviteeName, { color: colors.gray500 }]} numberOfLines={1}>
                {item.invitee_name}
              </Text>
            )}
            <Text style={[styles.invitationDate, { color: colors.gray400 }]}>
              {t('gestion.invitations.sentAt', { date: formatRelativeTime(item.created_at) })}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: withOpacity(statusColor, OPACITY[15]) }]}>
            <StatusIcon size={12} color={statusColor} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {t(statusConfig.label)}
            </Text>
          </View>
        </View>

        {item.message && (
          <View style={[styles.messageContainer, { backgroundColor: colors.gray50 }]}>
            <Text style={[styles.messageText, { color: colors.textSecondary }]} numberOfLines={2}>
              "{item.message}"
            </Text>
          </View>
        )}

        {item.status === 'PENDING' && (
          <View style={styles.actionButtons}>
            <Button
              title={t('gestion.invitations.resend')}
              onPress={() => handleResendInvitation(item)}
              size="sm"
              variant="secondary"
              icon={<Send size={14} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
              style={[styles.actionButton, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}
              textStyle={[styles.actionButtonText, { color: colors.primary }]}
              fullWidth
            />

            <Button
              title={t('common.cancel')}
              onPress={() => handleCancelInvitation(item)}
              size="sm"
              variant="secondary"
              icon={<Trash2 size={14} color={colors.error} strokeWidth={ICON.strokeWidth} />}
              style={[styles.actionButton, { backgroundColor: withOpacity(colors.error, OPACITY[15]) }]}
              textStyle={[styles.actionButtonText, { color: colors.error }]}
              fullWidth
            />
          </View>
        )}
      </View>
    );
  };

  const rightAction = (
    <IconButton
      onPress={() => setShowInviteModal(true)}
      icon={<UserPlus size={20} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
      accessibilityLabel={t('gestion.invitations.inviteMember')}
      variant="filled"
      size="sm"
      style={[styles.addButton, { backgroundColor: colors.primary }]}
    />
  );

  return (
    <>
    <PageLayout
      title={t('gestion.invitations.pendingTitle')}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      rightAction={rightAction}
    >
      {invitations.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t('gestion.invitations.noPending')}
          subtitle={t('gestion.invitations.noPendingDesc')}
          actionLabel={t('gestion.invitations.inviteMember')}
          onAction={() => setShowInviteModal(true)}
        />
      ) : (
        invitations.map((item) => (
          <View key={item.id} style={styles.cardWrapper}>
            {renderInvitationItem({ item })}
          </View>
        ))
      )}
    </PageLayout>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <KeyboardAwareScrollView
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          contentContainerStyle={styles.modalOverlayContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('gestion.invitations.inviteMember')}
            </Text>

            <Text style={[styles.inputLabel, { color: colors.gray600 }]}>{t('gestion.invitations.emailRequired')}</Text>
            <Input
              placeholder={t('gestion.invitations.emailPlaceholder')}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              inputContainerStyle={[
                styles.textInput,
                { backgroundColor: colors.gray50, borderColor: colors.gray300 },
              ]}
              inputStyle={{ color: colors.textPrimary }}
            />

            <Text style={[styles.inputLabel, { color: colors.gray600 }]}>
              {t('gestion.invitations.personalMessage')}
            </Text>
            <FormTextArea
              placeholder={t('gestion.invitations.personalMessagePlaceholder')}
              value={inviteMessage}
              onChangeText={setInviteMessage}
              rows={3}
              containerStyle={styles.messageInput}
            />

            <View style={styles.modalButtons}>
              <Button
                title={t('common.cancel')}
                onPress={() => setShowInviteModal(false)}
                disabled={isSendingInvite}
                variant="outline"
                fullWidth
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.gray300 }]}
                textStyle={[styles.cancelButtonText, { color: colors.textPrimary }]}
              />

              <Button
                title={t('gestion.invitations.send')}
                onPress={handleSendInvite}
                disabled={isSendingInvite}
                loading={isSendingInvite}
                fullWidth
                icon={<Send size={16} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
                style={[styles.modalButton, styles.inviteButton, { backgroundColor: colors.primary }]}
                textStyle={[styles.inviteButtonText, { color: colors.textOnPrimary }]}
              />
            </View>
          </View>
        </KeyboardAwareScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardWrapper: {
    marginBottom: SPACING.md,
  },

  invitationCard: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    padding: SPACING.md,
  },

  invitationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  invitationInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },

  inviteeEmail: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  inviteeName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  invitationDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 4,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER.radius.full,
  },

  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  messageContainer: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },

  messageText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontStyle: 'italic',
  },

  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.md,
  },

  actionButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    padding: SPACING.lg,
  },
  modalOverlayContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BORDER.radius.lg,
    padding: SPACING.xl,
  },

  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },

  inputLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  textInput: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.md,
    marginBottom: SPACING.md,
  },

  messageInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },

  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER.radius.md,
    minHeight: 48,
  },

  cancelButton: {
    borderWidth: BORDER.width.thin,
  },

  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  inviteButton: {},

  inviteButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
