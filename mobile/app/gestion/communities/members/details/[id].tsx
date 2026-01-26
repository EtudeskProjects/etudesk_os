import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Star,
  User,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  SquarePen,
  Save,
  Trash2,
  ChevronDown,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, ICON, BORDER } from '../../../../../src/constants/theme';
import { Button, FooterNav } from '../../../../../src/components/ui';
import { useTheme } from '../../../../../src/hooks/useTheme';
import { communityService } from '../../../../../src/services';
import { formatRelativeTime, formatDate } from '../../../../../src/utils/date';
import type { MemberStatus, CommunityMemberDetails } from '../../../../../src/services/communityService';

// Status configuration
const STATUS_CONFIG: Record<MemberStatus, { color: string; icon: typeof Clock }> = {
  PENDING: { color: COLORS.warning, icon: Clock },
  ACTIVE: { color: COLORS.success, icon: CheckCircle2 },
  REJECTED: { color: COLORS.error, icon: XCircle },
  SUSPENDED: { color: COLORS.gray500, icon: XCircle },
};

// Status flow with descriptions
const STATUS_FLOW: Record<MemberStatus, {
  label: string;
  description: string;
  color: string;
}> = {
  PENDING: {
    label: 'En attente',
    description: 'Demande en cours de validation',
    color: COLORS.warning,
  },
  ACTIVE: {
    label: 'Membre actif',
    description: 'Membre approuvé de la communauté',
    color: COLORS.success,
  },
  REJECTED: {
    label: 'Refusé',
    description: 'Demande non retenue',
    color: COLORS.error,
  },
  SUSPENDED: {
    label: 'Suspendu',
    description: 'Membre temporairement suspendu',
    color: COLORS.gray500,
  },
};

type Tab = 'profile' | 'notes';

export default function MemberDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const [membership, setMembership] = useState<CommunityMemberDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Form states
  const [internalNotes, setInternalNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Status picker
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Handle keyboard events
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    loadMembership();
  }, [id]);

  const loadMembership = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const response = await communityService.getMembershipDetails(id);
      setMembership(response.data);
      setInternalNotes(response.data?.internal_notes || '');
      setRating(response.data?.rating || 0);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les détails du membre.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: MemberStatus) => {
    if (!membership) return;

    try {
      await communityService.updateMembershipStatus(membership.id, newStatus);
      setMembership((prev) => prev ? { ...prev, status: newStatus } : null);
      setShowStatusPicker(false);
      Alert.alert('Succès', `Statut mis à jour: ${STATUS_FLOW[newStatus].label}`);
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de mettre à jour le statut.');
    }
  };

  const handleDeleteMember = () => {
    if (!membership) return;

    const memberName = membership.talent?.first_name && membership.talent?.last_name
      ? `${membership.talent.first_name} ${membership.talent.last_name}`
      : membership.talent?.display_name || 'ce membre';

    Alert.alert(
      'Supprimer le membre',
      `Êtes-vous sûr de vouloir supprimer ${memberName} ? Cette action est irréversible et permettra au membre de postuler à nouveau.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.deleteMember(membership.id);
              Alert.alert('Succès', 'Membre supprimé.');
              router.back();
            } catch (error: any) {
              Alert.alert('Erreur', error.error || 'Impossible de supprimer le membre.');
            }
          },
        },
      ]
    );
  };

  const handleSaveNotes = async () => {
    if (!membership) return;

    try {
      await communityService.updateMemberNotes(membership.id, internalNotes);
      setIsEditingNotes(false);
      Alert.alert('Succès', 'Notes enregistrées.');
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de sauvegarder les notes.');
    }
  };

  const handleUpdateRating = async (newRating: number) => {
    if (!membership) return;

    try {
      await communityService.updateMemberRating(membership.id, newRating);
      setRating(newRating);
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de mettre à jour la note.');
    }
  };

  const getInitials = (firstName?: string, lastName?: string): string => {
    const f = firstName?.[0] || '';
    const l = lastName?.[0] || '';
    return (f + l).toUpperCase() || '?';
  };

  const renderTab = (tab: Tab, label: string) => {
    const isActive = activeTab === tab;

    return (
      <TouchableOpacity
        style={[styles.tab, isActive && { borderBottomColor: colors.primary }]}
        onPress={() => setActiveTab(tab)}
      >
        <Text
          style={[
            styles.tabText,
            { color: isActive ? colors.primary : colors.gray500 },
            isActive && { fontWeight: TYPOGRAPHY.fontWeight.semibold },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderProfileTab = () => {
    const talent = membership?.talent;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Talent Info */}
        <View style={[styles.profileHeader, { backgroundColor: colors.gray50 }]}>
          {talent?.profile_picture_url || talent?.avatar_url ? (
            <Image source={{ uri: talent.profile_picture_url || talent.avatar_url }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.profileAvatarText, { color: colors.primary }]}>
                {getInitials(talent?.first_name, talent?.last_name)}
              </Text>
            </View>
          )}
          <Text style={[styles.profileName, { color: colors.textPrimary }]}>
            {talent ? `${talent.first_name} ${talent.last_name}` : 'Membre'}
          </Text>
          {talent?.headline && (
            <Text style={[styles.profileHeadline, { color: colors.gray500 }]}>
              {talent.headline}
            </Text>
          )}
        </View>

        {/* Talent Details */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Informations</Text>

          {(talent?.city || talent?.country) && (
            <View style={styles.infoRow}>
              <MapPin size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {[talent?.city, talent?.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}

          {talent?.email && (
            <View style={styles.infoRow}>
              <Mail size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {talent.email}
              </Text>
            </View>
          )}

          {talent?.phone && (
            <View style={styles.infoRow}>
              <Phone size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {talent.phone}
              </Text>
            </View>
          )}

          {talent?.bio && (
            <View style={[styles.bioContainer, { marginTop: SPACING.sm }]}>
              <Text style={[styles.bioText, { color: colors.textSecondary }]}>
                {talent.bio}
              </Text>
            </View>
          )}
        </View>

        {/* Rating */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Évaluation du membre</Text>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => handleUpdateRating(star)}>
                <Star
                  size={32}
                  color={star <= rating ? COLORS.warning : colors.gray300}
                  fill={star <= rating ? COLORS.warning : 'transparent'}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Status */}
        {membership?.status && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Statut de l'adhésion</Text>

            <View style={[styles.currentStatusDisplay, { backgroundColor: (STATUS_FLOW[membership.status as MemberStatus]?.color || COLORS.warning) + '10' }]}>
              {(() => {
                const config = STATUS_CONFIG[membership.status as MemberStatus] || STATUS_CONFIG.PENDING;
                const StatusIcon = config.icon;
                return <StatusIcon size={20} color={STATUS_FLOW[membership.status as MemberStatus]?.color || COLORS.warning} strokeWidth={ICON.strokeWidth} />;
              })()}
              <Text style={[styles.currentStatusDisplayText, { color: STATUS_FLOW[membership.status as MemberStatus]?.color || COLORS.warning }]}>
                {STATUS_FLOW[membership.status as MemberStatus]?.label || membership.status}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.statusPickerButton, { borderColor: colors.gray300 }]}
              onPress={() => setShowStatusPicker(!showStatusPicker)}
            >
              <Text style={[styles.statusPickerButtonText, { color: colors.textPrimary }]}>
                Changer le statut
              </Text>
              <ChevronDown
                size={20}
                color={colors.gray500}
                strokeWidth={ICON.strokeWidth}
                style={{ transform: [{ rotate: showStatusPicker ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {showStatusPicker && (
              <View style={[styles.statusOptions, { borderColor: colors.gray200 }]}>
                {(Object.keys(STATUS_FLOW) as MemberStatus[])
                  .filter(status => status !== membership.status)
                  .map((status) => {
                    const config = STATUS_CONFIG[status];
                    const flow = STATUS_FLOW[status];
                    const Icon = config.icon;

                    return (
                      <TouchableOpacity
                        key={status}
                        style={[styles.statusOption, { borderBottomColor: colors.gray100 }]}
                        onPress={() => handleUpdateStatus(status)}
                      >
                        <View style={[styles.statusOptionIcon, { backgroundColor: config.color + '15' }]}>
                          <Icon size={16} color={config.color} strokeWidth={ICON.strokeWidth} />
                        </View>
                        <View style={styles.statusOptionInfo}>
                          <Text style={[styles.statusOptionLabel, { color: colors.textPrimary }]}>
                            {flow.label}
                          </Text>
                          <Text style={[styles.statusOptionDesc, { color: colors.gray500 }]}>
                            {flow.description}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}
          </View>
        )}

        {/* Answers */}
        {membership?.answers && Array.isArray(membership.answers) && membership.answers.length > 0 && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Réponses aux questions</Text>
            {membership.answers.map((answer: any, index: number) => (
              <View key={index} style={[styles.qaItem, index > 0 && { borderTopColor: colors.gray200, borderTopWidth: 1, paddingTop: SPACING.md, marginTop: SPACING.md }]}>
                <Text style={[styles.qaQuestion, { color: colors.gray600 }]}>
                  {answer.question}
                </Text>
                <Text style={[styles.qaAnswer, { color: colors.textPrimary }]}>
                  {answer.answer}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Delete button */}
        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: COLORS.error }]}
          onPress={handleDeleteMember}
        >
          <Trash2 size={18} color={COLORS.error} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.deleteButtonText, { color: COLORS.error }]}>
            Supprimer ce membre
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  const renderNotesTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
        <View style={styles.notesHeader}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Notes internes</Text>
          <TouchableOpacity onPress={() => isEditingNotes ? handleSaveNotes() : setIsEditingNotes(true)}>
            {isEditingNotes ? (
              <Save size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />
            ) : (
              <SquarePen size={20} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
            )}
          </TouchableOpacity>
        </View>
        <TextInput
          style={[styles.notesInput, { backgroundColor: colors.gray50, color: colors.textPrimary }]}
          placeholder="Ajoutez des notes internes sur ce membre..."
          placeholderTextColor={colors.gray400}
          value={internalNotes}
          onChangeText={setInternalNotes}
          multiline
          numberOfLines={8}
          editable={isEditingNotes}
        />
        <Text style={[styles.notesHint, { color: colors.gray400 }]}>
          Ces notes sont visibles uniquement par votre équipe.
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!membership) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          Membre non trouvé
        </Text>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[membership.status as MemberStatus] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '15' }]}>
            <StatusIcon size={14} color={statusConfig.color} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {STATUS_FLOW[membership.status as MemberStatus]?.label || membership.status}
            </Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.gray200 }]}>
        {renderTab('profile', 'Profil')}
        {renderTab('notes', 'Notes')}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.contentContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'notes' && renderNotesTab()}
      </KeyboardAvoidingView>

      <FooterNav activeTab="gestion" />
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

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },

  errorText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerContent: {
    flex: 1,
    alignItems: 'center',
  },

  headerSpacer: {
    width: 40,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.full,
  },

  statusText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: BORDER.width.thin,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  contentContainer: {
    flex: 1,
  },

  tabContent: {
    flex: 1,
    padding: SPACING.lg,
  },

  profileHeader: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
  },

  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: SPACING.md,
  },

  profileAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },

  profileAvatarText: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  profileName: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  profileHeadline: {
    fontSize: TYPOGRAPHY.fontSize.md,
    marginTop: 4,
  },

  section: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    marginBottom: SPACING.md,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  infoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },

  bioContainer: {
    paddingTop: SPACING.sm,
    borderTopWidth: BORDER.width.thin,
    borderTopColor: COLORS.gray200,
  },

  bioText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },

  ratingContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
  },

  currentStatusDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.sm,
  },

  currentStatusDisplayText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  statusPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
  },

  statusPickerButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  statusOptions: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
  },

  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderBottomWidth: 1,
  },

  statusOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusOptionInfo: {
    flex: 1,
  },

  statusOptionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  statusOptionDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  qaItem: {
    marginBottom: SPACING.md,
  },

  qaQuestion: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  qaAnswer: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: 22,
  },

  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.md,
  },

  deleteButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  bottomSpacer: {
    height: SPACING.xl,
  },

  // Messages
  messagesContainer: {
    flex: 1,
  },

  loadingMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  messagesList: {
    flex: 1,
  },

  messagesContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },

  noMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    minHeight: 300,
  },

  noMessagesTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },

  noMessagesText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
  },

  // Notes
  notesCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },

  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  notesInput: {
    minHeight: 150,
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlignVertical: 'top',
  },

  notesHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.sm,
  },
});
