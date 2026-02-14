/**
 * Space Invitations Management Screen
 * For organization admins to invite users to book a space
 * Lists only pending invitations (accepted/declined are deleted)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
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
  X,
  RefreshCw,
  Trash2,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../src/constants/theme';
import { useTheme } from '../../../../src/hooks/useTheme';
import { Button, FooterNav } from '../../../../src/components/ui';
import {
  spaceInvitationService,
  SpaceInvitation,
} from '../../../../src/services/spaceInvitationService';
import { useAlert } from '../../../../src/contexts/AlertContext';

export default function SpaceInvitationsScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [invitations, setInvitations] = useState<SpaceInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal state for sending new invitations
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const modalScrollRef = useRef<ScrollView>(null);

  const fetchInvitations = useCallback(async () => {
    if (!spaceId) return;

    try {
      const response = await spaceInvitationService.getSpaceInvitations(spaceId, {
        status: 'PENDING',
        limit: 100
      });

      if (response.data) {
        // Filter only pending (non-expired) invitations
        const pendingInvitations = (response.data.data || []).filter(
          (inv: SpaceInvitation) => new Date(inv.expires_at) >= new Date()
        );
        setInvitations(pendingInvitations);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [spaceId]);
  const alerts = useAlert();

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchInvitations();
  };

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteName('');
    setInviteMessage('');
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      void alerts.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }

    setIsSending(true);
    try {
      const response = await spaceInvitationService.sendInvitations(spaceId!, [
        {
          email: inviteEmail.trim().toLowerCase(),
          name: inviteName.trim() || undefined,
          message: inviteMessage.trim() || undefined,
        },
      ]);

      if (response.data) {
        if (response.data.sent > 0) {
          void alerts.alert('Succes', `Invitation envoyee a ${inviteEmail}`);
          setShowInviteModal(false);
          resetInviteForm();
          fetchInvitations();
        } else if (response.data.errors && response.data.errors.length > 0) {
          void alerts.alert('Erreur', response.data.errors[0].error);
        }
      }
    } catch (error: any) {
      void alerts.alert('Erreur', error.message || 'Impossible d\'envoyer l\'invitation');
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async (invitation: SpaceInvitation) => {
    setProcessingId(invitation.id);
    try {
      await spaceInvitationService.resendInvitation(spaceId!, invitation.id);
      void alerts.alert('Succes', 'Invitation renvoyee');
      fetchInvitations();
    } catch (error: any) {
      void alerts.alert('Erreur', error.message || 'Impossible de renvoyer l\'invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (invitation: SpaceInvitation) => {
    void alerts.showAlert({ title: 'Annuler l\'invitation', message: `Voulez-vous vraiment annuler l'invitation a ${invitation.invitee_email}?`, buttons: [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(invitation.id);
            try {
              await spaceInvitationService.cancelInvitation(spaceId!, invitation.id);
              setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
            } catch (error: any) {
              void alerts.alert('Erreur', error.message || 'Impossible d\'annuler l\'invitation');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ] });
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

  const getExpiresIn = (dateString: string) => {
    const expires = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Expiree';
    if (diffDays === 1) return 'Expire demain';
    return `Expire dans ${diffDays} jours`;
  };

  const scrollModalTo = useCallback((y: number) => {
    if (Platform.OS !== 'android') return;
    setTimeout(() => {
      modalScrollRef.current?.scrollTo({ y, animated: true });
    }, 120);
  }, []);

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

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : invitations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Mail size={48} color={colors.gray300} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            Aucune invitation en attente
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Envoyez des invitations pour permettre des reservations
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
          <Text style={[styles.sectionInfo, { color: colors.textSecondary }]}>
            {invitations.length} invitation{invitations.length > 1 ? 's' : ''} en attente
          </Text>

          {invitations.map((invitation) => {
            const isProcessing = processingId === invitation.id;

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
                  <View style={[styles.statusBadge, { backgroundColor: withOpacity(colors.warning, OPACITY[15]) }]}>
                    <Text style={[styles.statusText, { color: colors.warning }]}>
                      En attente
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Clock size={14} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                      {getExpiresIn(invitation.expires_at)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.cardActions, { borderTopColor: colors.borderColor }]}>
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
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Invite Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Inviter une personne
              </Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={modalScrollRef}
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
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
                onFocus={() => scrollModalTo(0)}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {/* Name */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Nom (optionnel)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.gray100, color: colors.textPrimary }]}
                placeholder="Prenom Nom"
                placeholderTextColor={colors.textDisabled}
                value={inviteName}
                onChangeText={setInviteName}
                onFocus={() => scrollModalTo(110)}
              />

              {/* Message */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Message personnel (optionnel)</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.gray100, color: colors.textPrimary }]}
                placeholder="Ajoutez un message personnalise..."
                placeholderTextColor={colors.textDisabled}
                value={inviteMessage}
                onChangeText={setInviteMessage}
                onFocus={() => scrollModalTo(230)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.borderColor }]}>
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
                title={isSending ? 'Envoi...' : 'Envoyer'}
                onPress={handleSendInvitation}
                variant="primary"
                disabled={isSending || !inviteEmail.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FooterNav />
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },

  backButton: {
    padding: SPACING.xs,
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    flex: 1,
    textAlign: 'center',
  },

  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },

  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
  },

  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },

  sectionInfo: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
  },

  invitationCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: 1,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  cardInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },

  email: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  name: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },

  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER.radius.full,
  },

  statusText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  cardDetails: {
    marginTop: SPACING.sm,
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
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },

  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.sm,
    borderWidth: 1,
  },

  actionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    borderTopLeftRadius: BORDER.radius.xl,
    borderTopRightRadius: BORDER.radius.xl,
    maxHeight: '90%',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },

  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  modalBody: {
    padding: SPACING.md,
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
    minHeight: 80,
    borderRadius: BORDER.radius.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    borderTopWidth: 1,
  },
});
