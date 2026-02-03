/**
 * Community Invitations Management Page
 * Shows pending invitations and allows adding new ones
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
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
import { PageLayout, EmptyState } from '../../../../../src/components/ui';
import { useTheme } from '../../../../../src/hooks/useTheme';
import { communityService, communityInvitationService, CommunityInvitation } from '../../../../../src/services';
import { formatRelativeTime } from '../../../../../src/utils/date';
import type { Community } from '../../../../../src/types/models';

// Status config - colors will be resolved dynamically in the component
const STATUS_CONFIG = {
  PENDING: { icon: Clock, label: 'En attente' },
};

export default function CommunityInvitationsScreen() {
  const { id: communityId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [community, setCommunity] = useState<Community | null>(null);
  const [invitations, setInvitations] = useState<CommunityInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

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
      console.log('Invitations loaded:', invitationsData.length, 'Pending:', pendingInvitations.length);
      setInvitations(pendingInvitations);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les invitations.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData().finally(() => setIsRefreshing(false));
  }, [communityId]);

  const handleCancelInvitation = (invitation: CommunityInvitation) => {
    Alert.alert(
      'Annuler l\'invitation',
      `Voulez-vous annuler l'invitation envoyée à ${invitation.invitee_email} ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityInvitationService.cancelInvitation(communityId!, invitation.id);
              handleRefresh();
              Alert.alert('Succès', 'Invitation annulée.');
            } catch (error: any) {
              Alert.alert('Erreur', error?.error || 'Impossible d\'annuler l\'invitation.');
            }
          },
        },
      ]
    );
  };

  const handleResendInvitation = async (invitation: CommunityInvitation) => {
    try {
      await communityInvitationService.resendInvitation(communityId!, invitation.id);
      Alert.alert('Succès', `Invitation renvoyée à ${invitation.invitee_email}.`);
    } catch (error: any) {
      Alert.alert('Erreur', error?.error || 'Impossible de renvoyer l\'invitation.');
    }
  };

  const handleSendInvite = async () => {
    if (!communityId) return;

    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide.');
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
        Alert.alert('Invitation envoyée', `Une invitation a été envoyée à ${email}.`);
      } else if (response.data?.errors?.length > 0) {
        Alert.alert('Erreur', response.data.errors[0]?.error || 'Impossible d\'envoyer l\'invitation.');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error?.error || 'Impossible d\'envoyer l\'invitation.');
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
              Envoyée {formatRelativeTime(item.created_at)}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: withOpacity(statusColor, OPACITY[15]) }]}>
            <StatusIcon size={12} color={statusColor} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusConfig.label}
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
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}
              onPress={() => handleResendInvitation(item)}
            >
              <Send size={14} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Renvoyer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: withOpacity(colors.error, OPACITY[15]) }]}
              onPress={() => handleCancelInvitation(item)}
            >
              <Trash2 size={14} color={colors.error} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const rightAction = (
    <TouchableOpacity
      style={[styles.addButton, { backgroundColor: colors.primary }]}
      onPress={() => setShowInviteModal(true)}
    >
      <UserPlus size={20} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
    </TouchableOpacity>
  );

  return (
    <>
    <PageLayout
      title="Invitations en attente"
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isLoading={isLoading}
      rightAction={rightAction}
    >
      {invitations.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aucune invitation en attente"
          subtitle="Invitez des personnes à rejoindre votre communauté."
          actionLabel="Inviter un membre"
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Inviter un membre
            </Text>

            <Text style={[styles.inputLabel, { color: colors.gray600 }]}>Email *</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.gray50,
                  color: colors.textPrimary,
                  borderColor: colors.gray300,
                },
              ]}
              placeholder="email@exemple.com"
              placeholderTextColor={colors.gray400}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: colors.gray600 }]}>
              Message personnalisé (optionnel)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                styles.messageInput,
                {
                  backgroundColor: colors.gray50,
                  color: colors.textPrimary,
                  borderColor: colors.gray300,
                },
              ]}
              placeholder="Ajoutez un message personnel..."
              placeholderTextColor={colors.gray400}
              value={inviteMessage}
              onChangeText={setInviteMessage}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.gray300 }]}
                onPress={() => setShowInviteModal(false)}
                disabled={isSendingInvite}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textPrimary }]}>
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.inviteButton, { backgroundColor: colors.primary }]}
                onPress={handleSendInvite}
                disabled={isSendingInvite}
              >
                {isSendingInvite ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <>
                    <Send size={16} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.inviteButtonText, { color: colors.textOnPrimary }]}>Envoyer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
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
