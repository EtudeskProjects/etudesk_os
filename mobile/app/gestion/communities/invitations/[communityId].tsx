/**
 * Community Invitations Management Screen
 * For organization admins to manage sent invitations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Plus,
  Mail,
  Clock,
  Check,
  X,
  Send,
  RefreshCw,
  Trash2,
  Users,
  Search,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../src/constants/theme';
import { useTheme } from '../../../../src/hooks/useTheme';
import { Button, Chip, IconButton, Input, LoadingShimmer, RadioRow, ShimmerPlaceholder } from '../../../../src/components/ui';
import { FormTextArea } from '../../../../src/components/forms/FormTextArea';
import {
  communityInvitationService,
  CommunityInvitation,
  InvitationStatus,
  InvitationRole,
} from '../../../../src/services/communityInvitationService';
import { useAlert } from '../../../../src/contexts/AlertContext';
import { ScrollToInputContext } from '../../../../src/contexts/ScrollToInputContext';
import { useI18n } from '../../../../src/contexts/I18nContext';

const STATUS_TABS: { key: InvitationStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'gestion.invitations.filterAll' },
  { key: 'PENDING', label: 'gestion.invitations.filterPending' },
  { key: 'ACCEPTED', label: 'gestion.invitations.statusAccepted' },
  { key: 'DECLINED', label: 'gestion.invitations.statusDeclined' },
  { key: 'EXPIRED', label: 'gestion.invitations.statusExpired' },
];

const ROLE_OPTIONS: { key: InvitationRole; label: string }[] = [
  { key: 'MEMBER', label: 'gestion.invitations.roleMember' },
  { key: 'ADMIN', label: 'gestion.invitations.roleAdmin' },
];

export default function CommunityInvitationsScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, locale } = useI18n();

  const [invitations, setInvitations] = useState<CommunityInvitation[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeStatus, setActiveStatus] = useState<InvitationStatus | 'ALL'>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal state for sending new invitations
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteRole, setInviteRole] = useState<InvitationRole>('MEMBER');
  const [isSending, setIsSending] = useState(false);
  const modalScrollRef = useRef<ScrollView>(null);

  const fetchInvitations = useCallback(async () => {
    try {
      const response = await communityInvitationService.getCommunityInvitations(communityId!, {
        status: activeStatus === 'ALL' ? undefined : activeStatus,
        limit: 100,
      });
      if (response.data) {
        setInvitations(response.data.data);
        setStatusCounts(response.data.statusCounts);
      }
    } catch (error) {
      if (__DEV__) console.error('Error fetching invitations:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [communityId, activeStatus]);
  const alerts = useAlert();

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchInvitations();
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      void alerts.alert(t('common.error'), t('gestion.invitations.invalidEmail'));
      return;
    }

    setIsSending(true);
    try {
      const response = await communityInvitationService.sendInvitations(communityId!, [
        {
          email: inviteEmail.trim().toLowerCase(),
          name: inviteName.trim() || undefined,
          message: inviteMessage.trim() || undefined,
          role: inviteRole,
        },
      ]);

      if (response.data) {
        if (response.data.sent > 0) {
          void alerts.alert(t('common.success'), t('gestion.invitations.sentTo', { email: inviteEmail }));
          setShowInviteModal(false);
          resetInviteForm();
          fetchInvitations();
        } else if (response.data.errors.length > 0) {
          void alerts.alert(t('common.error'), response.data.errors[0].error);
        }
      }
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.message || t('gestion.invitations.sendError'));
    } finally {
      setIsSending(false);
    }
  };

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteName('');
    setInviteMessage('');
    setInviteRole('MEMBER');
  };

  const handleResend = async (invitation: CommunityInvitation) => {
    setProcessingId(invitation.id);
    try {
      await communityInvitationService.resendInvitation(communityId!, invitation.id);
      void alerts.alert(t('common.success'), t('gestion.invitations.resendSuccess'));
      fetchInvitations();
    } catch (error: any) {
      void alerts.alert(t('common.error'), error.message || t('gestion.invitations.resendError'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (invitation: CommunityInvitation) => {
    void alerts.showAlert({ title: t('gestion.invitations.cancelInvitation'), message: t('gestion.invitations.cancelInvitationMessage', { email: invitation.invitee_email }), buttons: [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('gestion.invitations.cancelYes'),
          style: 'destructive',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              await communityInvitationService.cancelInvitation(communityId!, invitation.id);
              setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
            } catch (error: any) {
              void alerts.alert(t('common.error'), error.message || t('gestion.invitations.cancelError'));
            } finally {
              setProcessingId(null);
            }
          },
        },
      ] });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: InvitationStatus) => {
    switch (status) {
      case 'PENDING':
        return colors.warning;
      case 'ACCEPTED':
        return colors.success;
      case 'DECLINED':
        return colors.error;
      case 'EXPIRED':
        return colors.gray500;
      case 'CANCELLED':
        return colors.gray400;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: InvitationStatus) => {
    switch (status) {
      case 'PENDING':
        return t('gestion.invitations.pending');
      case 'ACCEPTED':
        return t('gestion.invitations.statusAccepted');
      case 'DECLINED':
        return t('gestion.invitations.statusDeclined');
      case 'EXPIRED':
        return t('gestion.invitations.statusExpired');
      case 'CANCELLED':
        return t('gestion.invitations.statusCancelled');
      default:
        return status;
    }
  };

  const getRoleLabel = (role: InvitationRole) => {
    switch (role) {
      case 'ADMIN':
        return t('gestion.invitations.roleAdmin');
      case 'MEMBER':
        return t('gestion.invitations.roleMember');
      default:
        return role;
    }
  };

  const scrollModalToInput = useCallback((targetNodeHandle: number, extraOffset = 120) => {
    const sv = modalScrollRef.current;
    if (!sv) return;
    const delay = Platform.OS === 'android' ? 120 : 0;
    setTimeout(() => {
      sv.scrollResponderScrollNativeHandleToKeyboard(targetNodeHandle, extraOffset, true);
    }, delay);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('common.back')}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('gestion.invitations.title')}</Text>
        <IconButton
          variant="filled"
          onPress={() => setShowInviteModal(true)}
          icon={<Plus size={20} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('gestion.invitations.sendInvitation')}
          style={{ backgroundColor: colors.primary }}
        />
      </View>

      {/* Status Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
	        {STATUS_TABS.map((tab) => {
	          const count = tab.key === 'ALL'
	            ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
	            : statusCounts[tab.key] || 0;
	          const isActive = activeStatus === tab.key;
	
	          return (
	            <Chip
	              key={tab.key}
	              onPress={() => setActiveStatus(tab.key)}
	              label={count > 0 ? `${t(tab.label)} (${count})` : t(tab.label)}
	              selected={isActive}
	              style={[
	                styles.tab,
	                { backgroundColor: isActive ? colors.primary : colors.gray100, borderColor: isActive ? colors.primary : 'transparent' },
	              ]}
	              textStyle={[styles.tabText, { color: isActive ? colors.textOnPrimary : colors.textSecondary }]}
	            />
	          );
	        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <LoadingShimmer variant="fullPage" />
        </View>
      ) : invitations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Mail size={48} color={colors.gray300} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {t('gestion.invitations.noInvitations')}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('gestion.invitations.noInvitationsDesc')}
          </Text>
          <Button
            title={t('gestion.invitations.sendInvitation')}
            onPress={() => setShowInviteModal(true)}
            variant="primary"
            icon={<Plus size={18} color={colors.textOnPrimary} />}
            style={{ marginTop: SPACING.lg }}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {invitations.map((invitation) => {
            const isProcessing = processingId === invitation.id;
            const statusColor = getStatusColor(invitation.status);

            return (
              <View
                key={invitation.id}
                style={[styles.invitationCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.email, { color: colors.textPrimary }]}>
                      {invitation.invitee_email}
                    </Text>
                    {invitation.invitee_name && (
                      <Text style={[styles.name, { color: colors.textSecondary }]}>
                        {invitation.invitee_name}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: withOpacity(statusColor, OPACITY[15]) }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {getStatusLabel(invitation.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Users size={14} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                      {getRoleLabel(invitation.role)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Clock size={14} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                      {t('gestion.invitations.sentOn', { date: formatDate(invitation.sent_at) })}
                    </Text>
                  </View>
                  {invitation.responded_at && (
                    <View style={styles.detailRow}>
                      <Check size={14} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        {t('gestion.invitations.respondedOn', { date: formatDate(invitation.responded_at) })}
                      </Text>
                    </View>
                  )}
                </View>

	                {invitation.status === 'PENDING' && (
	                  <View style={[styles.cardActions, { borderTopColor: colors.borderColor }]}>
	                    <Button
	                      title={t('gestion.invitations.resend')}
	                      onPress={() => handleResend(invitation)}
	                      disabled={isProcessing}
	                      loading={isProcessing}
	                      variant="outline"
	                      size="sm"
	                      icon={!isProcessing ? <RefreshCw size={16} color={colors.primary} /> : undefined}
	                      style={[styles.actionButton, { borderColor: colors.borderColor }]}
	                      textStyle={[styles.actionText, { color: colors.primary }]}
	                    />
	
	                    <Button
	                      title={t('common.cancel')}
	                      onPress={() => handleCancel(invitation)}
	                      disabled={isProcessing}
	                      variant="outline"
	                      size="sm"
	                      icon={<Trash2 size={16} color={colors.error} />}
	                      style={[styles.actionButton, { borderColor: colors.error }]}
	                      textStyle={[styles.actionText, { color: colors.error }]}
	                    />
	                  </View>
	                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Invite Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
	            <View style={[styles.modalHeader, { borderBottomColor: colors.borderColor }]}>
	              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
	                {t('gestion.invitations.inviteMember')}
	              </Text>
	              <IconButton
	                onPress={() => setShowInviteModal(false)}
	                icon={<X size={24} color={colors.textSecondary} />}
	                accessibilityLabel={t('common.close')}
	                size="sm"
	                variant="ghost"
	              />
	            </View>

	            <ScrollToInputContext.Provider value={scrollModalToInput}>
	            <ScrollView
	              ref={modalScrollRef}
	              style={styles.modalBody}
	              keyboardShouldPersistTaps="handled"
	              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
	            >
              {/* Email */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
                {t('gestion.invitations.email')} <Text style={{ color: colors.error }}>*</Text>
              </Text>
	              <Input
	                placeholder={t('gestion.invitations.emailPlaceholder')}
	                value={inviteEmail}
	                onChangeText={setInviteEmail}
	                keyboardType="email-address"
	                autoCapitalize="none"
	                autoCorrect={false}
	                inputContainerStyle={[{ backgroundColor: colors.gray100, borderColor: 'transparent', borderWidth: 0 }, styles.input]}
	                inputStyle={{ color: colors.textPrimary }}
	              />

              {/* Name */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>{t('gestion.invitations.nameOptional')}</Text>
	              <Input
	                placeholder={t('gestion.invitations.namePlaceholder')}
	                value={inviteName}
	                onChangeText={setInviteName}
	                inputContainerStyle={[{ backgroundColor: colors.gray100, borderColor: 'transparent', borderWidth: 0 }, styles.input]}
	                inputStyle={{ color: colors.textPrimary }}
	              />

              {/* Role */}
	              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>{t('gestion.invitations.role')}</Text>
	              <View style={styles.roleOptions}>
	                {ROLE_OPTIONS.map((option) => (
	                  <RadioRow
	                    key={option.key}
	                    onPress={() => setInviteRole(option.key)}
	                    selected={inviteRole === option.key}
	                    title={t(option.label)}
	                    style={[
	                      styles.roleOption,
	                      {
	                        backgroundColor: inviteRole === option.key ? colors.primary : colors.gray100,
	                        borderColor: inviteRole === option.key ? colors.primary : colors.borderColor,
	                      },
	                    ]}
	                    titleStyle={[
	                      styles.roleOptionText,
	                      { color: inviteRole === option.key ? colors.textOnPrimary : colors.textPrimary },
	                    ]}
	                    radioStyle={{ width: 0, height: 0, borderWidth: 0, opacity: 0 }}
	                  />
	                ))}
	              </View>

              {/* Message */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>{t('gestion.invitations.personalMessage')}</Text>
	              <FormTextArea
	                placeholder={t('gestion.invitations.personalMessagePlaceholder')}
	                value={inviteMessage}
	                onChangeText={setInviteMessage}
	                rows={3}
	                containerStyle={{ marginTop: 0 }}
	              />
	            </ScrollView>
	            </ScrollToInputContext.Provider>

            <View style={[styles.modalFooter, { borderTopColor: colors.borderColor }]}>
              <Button
                title={t('common.cancel')}
                onPress={() => {
                  setShowInviteModal(false);
                  resetInviteForm();
                }}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title={t('gestion.invitations.send')}
                onPress={handleSendInvitation}
                variant="primary"
                loading={isSending}
                disabled={!inviteEmail}
                icon={<Send size={18} color={colors.textOnPrimary} />}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabsContainer: {
    maxHeight: 60,
  },

  tabsContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },

  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.full,
    marginRight: SPACING.sm,
  },

  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  tabBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },

  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.lg,
  },

  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  invitationCard: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },

  cardInfo: {
    flex: 1,
  },

  email: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  name: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: BORDER.radius.xs,
  },

  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  cardDetails: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.xs,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  detailText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  cardActions: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
    borderTopWidth: BORDER.width.thin,
    borderTopColor: 'transparent',
  },

  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },

  actionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalContent: {
    borderTopLeftRadius: BORDER.radius.xl,
    borderTopRightRadius: BORDER.radius.xl,
    maxHeight: '90%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: BORDER.width.thin,
    borderBottomColor: 'transparent',
  },

  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  modalBody: {
    padding: SPACING.lg,
  },

  inputLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },

  input: {
    height: 48,
    borderRadius: BORDER.radius.sm,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  textArea: {
    minHeight: 100,
    borderRadius: BORDER.radius.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  roleOptions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  roleOption: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER.radius.sm,
    borderWidth: BORDER.width.thin,
  },

  roleOptionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: BORDER.width.thin,
    borderTopColor: 'transparent',
  },
});
