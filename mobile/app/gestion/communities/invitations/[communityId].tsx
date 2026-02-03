/**
 * Community Invitations Management Screen
 * For organization admins to manage sent invitations
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
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
import { Button } from '../../../../src/components/ui';
import {
  communityInvitationService,
  CommunityInvitation,
  InvitationStatus,
  InvitationRole,
} from '../../../../src/services/communityInvitationService';

const STATUS_TABS: { key: InvitationStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'PENDING', label: 'En attente' },
  { key: 'ACCEPTED', label: 'Acceptées' },
  { key: 'DECLINED', label: 'Refusées' },
  { key: 'EXPIRED', label: 'Expirées' },
];

const ROLE_OPTIONS: { key: InvitationRole; label: string }[] = [
  { key: 'MEMBER', label: 'Membre' },
  { key: 'ADMIN', label: 'Administrateur' },
];

export default function CommunityInvitationsScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const router = useRouter();
  const { colors } = useTheme();

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
      console.error('Error fetching invitations:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [communityId, activeStatus]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchInvitations();
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
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
          Alert.alert('Succès', `Invitation envoyée à ${inviteEmail}`);
          setShowInviteModal(false);
          resetInviteForm();
          fetchInvitations();
        } else if (response.data.errors.length > 0) {
          Alert.alert('Erreur', response.data.errors[0].error);
        }
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'envoyer l\'invitation');
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
      Alert.alert('Succès', 'Invitation renvoyée');
      fetchInvitations();
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de renvoyer l\'invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (invitation: CommunityInvitation) => {
    Alert.alert(
      'Annuler l\'invitation',
      `Voulez-vous vraiment annuler l'invitation à ${invitation.invitee_email}?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              await communityInvitationService.cancelInvitation(communityId!, invitation.id);
              setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible d\'annuler l\'invitation');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
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
        return 'En attente';
      case 'ACCEPTED':
        return 'Acceptée';
      case 'DECLINED':
        return 'Refusée';
      case 'EXPIRED':
        return 'Expirée';
      case 'CANCELLED':
        return 'Annulée';
      default:
        return status;
    }
  };

  const getRoleLabel = (role: InvitationRole) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrateur';
      case 'MEMBER':
        return 'Membre';
      default:
        return role;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Invitations</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowInviteModal(true)}
        >
          <Plus size={20} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
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
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                { backgroundColor: isActive ? colors.primary : colors.gray100 },
              ]}
              onPress={() => setActiveStatus(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? colors.textOnPrimary : colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    { backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : colors.primary },
                  ]}
                >
                  <Text
                    style={[styles.tabBadgeText, { color: colors.textOnPrimary }]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : invitations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Mail size={48} color={colors.gray300} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Aucune invitation
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Envoyez des invitations pour ajouter des membres
          </Text>
          <Button
            title="Envoyer une invitation"
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
                      Envoyée le {formatDate(invitation.sent_at)}
                    </Text>
                  </View>
                  {invitation.responded_at && (
                    <View style={styles.detailRow}>
                      <Check size={14} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        Répondue le {formatDate(invitation.responded_at)}
                      </Text>
                    </View>
                  )}
                </View>

                {invitation.status === 'PENDING' && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: colors.borderColor }]}
                      onPress={() => handleResend(invitation)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <RefreshCw size={16} color={colors.primary} />
                          <Text style={[styles.actionText, { color: colors.primary }]}>Renvoyer</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: colors.error }]}
                      onPress={() => handleCancel(invitation)}
                      disabled={isProcessing}
                    >
                      <Trash2 size={16} color={colors.error} />
                      <Text style={[styles.actionText, { color: colors.error }]}>Annuler</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Invite Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Inviter un membre
              </Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Email */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
                Email <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.gray100, color: colors.textPrimary }]}
                placeholder="email@exemple.com"
                placeholderTextColor={colors.textDisabled}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {/* Name */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Nom (optionnel)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.gray100, color: colors.textPrimary }]}
                placeholder="Prénom Nom"
                placeholderTextColor={colors.textDisabled}
                value={inviteName}
                onChangeText={setInviteName}
              />

              {/* Role */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Rôle</Text>
              <View style={styles.roleOptions}>
                {ROLE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.roleOption,
                      {
                        backgroundColor: inviteRole === option.key ? colors.primary : colors.gray100,
                        borderColor: inviteRole === option.key ? colors.primary : colors.borderColor,
                      },
                    ]}
                    onPress={() => setInviteRole(option.key)}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        { color: inviteRole === option.key ? colors.textOnPrimary : colors.textPrimary },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Message */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Message personnel (optionnel)</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.gray100, color: colors.textPrimary }]}
                placeholder="Ajoutez un message personnalisé..."
                placeholderTextColor={colors.textDisabled}
                value={inviteMessage}
                onChangeText={setInviteMessage}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Annuler"
                onPress={() => {
                  setShowInviteModal(false);
                  resetInviteForm();
                }}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title="Envoyer"
                onPress={handleSendInvitation}
                variant="primary"
                loading={isSending}
                disabled={!inviteEmail}
                icon={<Send size={18} color={colors.textOnPrimary} />}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
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
    borderTopColor: '#E5E7EB',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    borderBottomColor: '#E5E7EB',
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
    borderTopColor: '#E5E7EB',
  },
});
