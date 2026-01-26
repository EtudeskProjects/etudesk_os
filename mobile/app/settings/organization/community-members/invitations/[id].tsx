/**
 * Community Invitations Management Page
 * Shows pending invitations and allows adding new ones
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  UserPlus,
  Clock,
  Mail,
  Trash2,
  Send,
  Inbox,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../../../src/constants/theme';
import { FooterNav } from '../../../../../src/components/ui';
import { useTheme } from '../../../../../src/hooks/useTheme';
import { communityService, communityInvitationService, CommunityInvitation } from '../../../../../src/services';
import { formatRelativeTime } from '../../../../../src/utils/date';
import type { Community } from '../../../../../src/types/models';

const STATUS_CONFIG = {
  PENDING: { color: COLORS.warning, icon: Clock, label: 'En attente' },
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

    return (
      <View style={[styles.invitationCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
        <View style={styles.invitationHeader}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
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

          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '15' }]}>
            <StatusIcon size={12} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
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
              style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]}
              onPress={() => handleResendInvitation(item)}
            >
              <Send size={14} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Renvoyer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error + '15' }]}
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

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.gray100 }]}>
        <Inbox size={48} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        Aucune invitation en attente
      </Text>
      <Text style={[styles.emptyDescription, { color: colors.gray500 }]}>
        Invitez des personnes à rejoindre votre communauté.
      </Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: colors.primary }]}
        onPress={() => setShowInviteModal(true)}
      >
        <UserPlus size={18} color="#fff" strokeWidth={ICON.strokeWidth} />
        <Text style={styles.emptyButtonText}>Inviter un membre</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            Invitations en attente
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.gray500 }]} numberOfLines={1}>
            {community?.name} • {invitations.length} en attente
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowInviteModal(true)}
        >
          <UserPlus size={20} color="#fff" strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
      </View>

      {/* Invitations List */}
      <FlatList
        data={invitations}
        renderItem={renderInvitationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

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
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={16} color="#fff" strokeWidth={ICON.strokeWidth} />
                    <Text style={styles.inviteButtonText}>Envoyer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FooterNav activeTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  backButton: {
    marginRight: SPACING.md,
  },

  headerContent: {
    flex: 1,
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },

  separator: {
    height: SPACING.md,
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

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
  },

  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },

  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  emptyDescription: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },

  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER.radius.md,
  },

  emptyButtonText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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
    color: '#fff',
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
