import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
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
  Mail,
  MapPin,
  Phone,
  SquarePen,
  Save,
  Trash2,
  ChevronDown,
  UserX,
  MessageCircle,
  FileText,
  Calendar,
  BarChart2,
  Shield,
  RefreshCw,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../../../src/constants/theme';
import { FooterNav, Toggle } from '../../../../../src/components/ui';
import { ChatMessage, ChatInput } from '../../../../../src/components/chat';
import { useTheme } from '../../../../../src/hooks/useTheme';
import { communityService, CommunityMemberDetails, MemberStatus, communityMembershipMessageService, MembershipMessage, MemberPermissions, DEFAULT_MEMBER_PERMISSIONS } from '../../../../../src/services';
import { formatRelativeTime, formatDate } from '../../../../../src/utils/date';
import { getFullImageUrl } from '../../../../../src/utils/image';

// Status configuration - colors resolved dynamically via colorKey
const STATUS_CONFIG: Record<MemberStatus, { colorKey: 'warning' | 'success' | 'error' | 'gray500'; icon: typeof Clock; label: string }> = {
  PENDING: { colorKey: 'warning', icon: Clock, label: 'En attente' },
  ACTIVE: { colorKey: 'success', icon: CheckCircle2, label: 'Actif' },
  REJECTED: { colorKey: 'error', icon: XCircle, label: 'Refusé' },
  SUSPENDED: { colorKey: 'gray500', icon: UserX, label: 'Suspendu' },
};

// Status flow with descriptions - colors resolved dynamically via colorKey
const STATUS_FLOW: Record<MemberStatus, { label: string; description: string; colorKey: 'warning' | 'success' | 'error' | 'gray500' }> = {
  PENDING: { label: 'En attente', description: 'Demande en cours d\'examen', colorKey: 'warning' },
  ACTIVE: { label: 'Actif', description: 'Membre actif de la communauté', colorKey: 'success' },
  REJECTED: { label: 'Refusé', description: 'Demande refusée', colorKey: 'error' },
  SUSPENDED: { label: 'Suspendu', description: 'Membre suspendu temporairement', colorKey: 'gray500' },
};

type Tab = 'profile' | 'answers' | 'messages' | 'notes';

export default function CommunityMemberDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const [member, setMember] = useState<CommunityMemberDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Messages state
  const [messages, setMessages] = useState<MembershipMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Form states
  const [internalNotes, setInternalNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Status picker
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Permissions state
  const [permissions, setPermissions] = useState<MemberPermissions>(DEFAULT_MEMBER_PERMISSIONS);
  const [communityDefaults, setCommunityDefaults] = useState<MemberPermissions>(DEFAULT_MEMBER_PERMISSIONS);
  const [isCustomPermissions, setIsCustomPermissions] = useState(false);
  const [memberRole, setMemberRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

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
    loadMember();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'messages' && member) {
      loadMessages();
    }
  }, [activeTab, member]);

  const loadMember = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const response = await communityService.getMembershipDetails(id);
      setMember(response.data);
      setInternalNotes(response.data.internal_notes || '');
      setRating(response.data.rating || 0);
      // Load permissions after member is loaded
      loadPermissions();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les détails du membre.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadPermissions = async () => {
    if (!id) return;

    setIsLoadingPermissions(true);
    try {
      const response = await communityService.getMemberPermissions(id);
      if (response.data) {
        setPermissions(response.data.permissions);
        setCommunityDefaults(response.data.communityDefaults);
        setIsCustomPermissions(response.data.isCustom);
        setMemberRole(response.data.role);
      }
    } catch (error: any) {
      if (error?.status !== 404) {
        console.error('Error loading permissions:', error);
      }
      setPermissions(DEFAULT_MEMBER_PERMISSIONS);
      setCommunityDefaults(DEFAULT_MEMBER_PERMISSIONS);
      setIsCustomPermissions(false);
      setMemberRole('MEMBER');
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  const handleTogglePermission = async (key: keyof MemberPermissions) => {
    if (memberRole === 'ADMIN') {
      Alert.alert('Info', 'Les administrateurs ont toujours toutes les permissions.');
      return;
    }

    const newPermissions = {
      ...permissions,
      [key]: !permissions[key],
    };

    setIsSavingPermissions(true);
    try {
      const response = await communityService.updateMemberPermissions(id!, newPermissions);
      if (response.data) {
        setPermissions(response.data.permissions);
        setIsCustomPermissions(response.data.isCustom);
        Alert.alert('Succès', response.data.message || 'Permissions mises à jour.');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de mettre à jour les permissions.');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleResetToDefaults = () => {
    if (memberRole === 'ADMIN') {
      Alert.alert('Info', 'Les administrateurs ont toujours toutes les permissions.');
      return;
    }

    Alert.alert(
      'Réinitialiser les permissions',
      'Voulez-vous réinitialiser les permissions de ce membre aux valeurs par défaut de la communauté ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          onPress: async () => {
            setIsSavingPermissions(true);
            try {
              const response = await communityService.updateMemberPermissions(id!, null);
              if (response.data) {
                setPermissions(communityDefaults);
                setIsCustomPermissions(false);
                Alert.alert('Succès', 'Permissions réinitialisées aux valeurs par défaut.');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.error || 'Impossible de réinitialiser les permissions.');
            } finally {
              setIsSavingPermissions(false);
            }
          },
        },
      ]
    );
  };

  const loadMessages = async () => {
    if (!member) return;

    setIsLoadingMessages(true);
    try {
      const response = await communityMembershipMessageService.getMessages(member.id);
      setMessages(response.data || []);
      await communityMembershipMessageService.markAllAsRead(member.id);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (data: {
    content: string;
    attachments?: { name: string; uri: string; type: string; size?: number }[];
    proposedDatetime?: string;
    datetimeType?: string;
  }) => {
    if (!member) return;

    setIsSending(true);
    try {
      const response = await communityMembershipMessageService.sendMessage(member.id, {
        content: data.content,
        attachments: data.attachments?.map(a => ({
          name: a.name,
          url: a.uri,
          type: a.type,
          size: a.size,
        })),
        proposed_datetime: data.proposedDatetime,
        datetime_type: data.datetimeType as any,
      });

      setMessages((prev) => [...prev, response.data]);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible d\'envoyer le message.');
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdateStatus = async (newStatus: MemberStatus, rejectionReason?: string) => {
    if (!member) return;

    try {
      await communityService.updateMembershipStatus(member.id, newStatus, rejectionReason);
      setMember((prev) => prev ? { ...prev, status: newStatus } : null);
      setShowStatusPicker(false);
      Alert.alert('Succès', `Statut mis à jour: ${STATUS_FLOW[newStatus].label}`);
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de mettre à jour le statut.');
    }
  };

  const handleDeleteMember = () => {
    if (!member) return;

    Alert.alert(
      'Supprimer le membre',
      'Êtes-vous sûr de vouloir supprimer ce membre ? Cette action permettra à la personne de postuler à nouveau.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityService.deleteMember(member.id);
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
    if (!member) return;

    try {
      await communityService.updateMemberNotes(member.id, internalNotes);
      setIsEditingNotes(false);
      Alert.alert('Succès', 'Notes enregistrées.');
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de sauvegarder les notes.');
    }
  };

  const handleUpdateRating = async (newRating: number) => {
    if (!member) return;

    try {
      await communityService.updateMemberRating(member.id, newRating);
      setRating(newRating);
    } catch (error: any) {
      Alert.alert('Erreur', error.error || 'Impossible de mettre à jour la note.');
    }
  };

  const getInitials = (firstName?: string, lastName?: string, displayName?: string): string => {
    if (displayName) {
      return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
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
    const talent = member?.talent;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Talent Info */}
        <View style={[styles.profileHeader, { backgroundColor: colors.gray50 }]}>
          {talent?.avatar_url || talent?.profile_picture_url ? (
            <Image
              source={{ uri: getFullImageUrl(talent.avatar_url || talent.profile_picture_url) || '' }}
              style={styles.profileAvatar}
            />
          ) : (
            <View style={[styles.profileAvatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
              <Text style={[styles.profileAvatarText, { color: colors.primary }]}>
                {getInitials(talent?.first_name, talent?.last_name, talent?.display_name)}
              </Text>
            </View>
          )}
          <Text style={[styles.profileName, { color: colors.textPrimary }]}>
            {talent?.display_name || `${talent?.first_name} ${talent?.last_name}` || 'Membre'}
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

          {/* Location */}
          {(talent?.city || talent?.country) && (
            <View style={styles.infoRow}>
              <MapPin size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {[talent?.city, talent?.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}

          {/* Email */}
          {talent?.email && (
            <View style={styles.infoRow}>
              <Mail size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {talent.email}
              </Text>
            </View>
          )}

          {/* Phone */}
          {talent?.phone && (
            <View style={styles.infoRow}>
              <Phone size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                {talent.phone}
              </Text>
            </View>
          )}

          {/* Bio */}
          {talent?.bio && (
            <View style={[styles.bioContainer, { marginTop: SPACING.sm, borderTopColor: colors.gray200 }]}>
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
                  color={star <= rating ? colors.warning : colors.gray300}
                  fill={star <= rating ? colors.warning : 'transparent'}
                  strokeWidth={ICON.strokeWidth}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Permissions Section */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Shield size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.sectionTitle, { color: colors.gray700, marginBottom: 0 }]}>
                Permissions
              </Text>
            </View>
            {memberRole === 'ADMIN' && (
              <View style={[styles.adminBadge, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                <Text style={[styles.adminBadgeText, { color: colors.primary }]}>Admin</Text>
              </View>
            )}
          </View>

          {isLoadingPermissions ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: SPACING.md }} />
          ) : memberRole === 'ADMIN' ? (
            <View style={[styles.permissionInfo, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
              <Text style={[styles.permissionInfoText, { color: colors.primary }]}>
                Les administrateurs ont toutes les permissions par défaut.
              </Text>
            </View>
          ) : (
            <>
              {/* Permission toggles */}
              <View style={styles.permissionsList}>
                {/* Can Post */}
                <View style={[styles.permissionItem, { borderColor: colors.gray200 }]}>
                  <View style={styles.permissionLeft}>
                    <View style={[styles.permissionIcon, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                      <FileText size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    </View>
                    <View>
                      <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                        Créer des publications
                      </Text>
                      <Text style={[styles.permissionDesc, { color: colors.gray500 }]}>
                        Peut publier du contenu
                      </Text>
                    </View>
                  </View>
                  <Toggle
                    value={permissions.can_post}
                    onValueChange={() => handleTogglePermission('can_post')}
                    disabled={isSavingPermissions}
                  />
                </View>

                {/* Can Create Event */}
                <View style={[styles.permissionItem, { borderColor: colors.gray200 }]}>
                  <View style={styles.permissionLeft}>
                    <View style={[styles.permissionIcon, { backgroundColor: withOpacity(colors.warning, OPACITY[15]) }]}>
                      <Calendar size={18} color={colors.warning} strokeWidth={ICON.strokeWidth} />
                    </View>
                    <View>
                      <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                        Créer des événements
                      </Text>
                      <Text style={[styles.permissionDesc, { color: colors.gray500 }]}>
                        Peut organiser des événements
                      </Text>
                    </View>
                  </View>
                  <Toggle
                    value={permissions.can_create_event}
                    onValueChange={() => handleTogglePermission('can_create_event')}
                    disabled={isSavingPermissions}
                  />
                </View>

                {/* Can Create Poll */}
                <View style={[styles.permissionItem, { borderColor: colors.gray200, borderBottomWidth: 0 }]}>
                  <View style={styles.permissionLeft}>
                    <View style={[styles.permissionIcon, { backgroundColor: withOpacity(colors.info, OPACITY[15]) }]}>
                      <BarChart2 size={18} color={colors.info} strokeWidth={ICON.strokeWidth} />
                    </View>
                    <View>
                      <Text style={[styles.permissionLabel, { color: colors.textPrimary }]}>
                        Créer des sondages
                      </Text>
                      <Text style={[styles.permissionDesc, { color: colors.gray500 }]}>
                        Peut lancer des sondages
                      </Text>
                    </View>
                  </View>
                  <Toggle
                    value={permissions.can_create_poll}
                    onValueChange={() => handleTogglePermission('can_create_poll')}
                    disabled={isSavingPermissions}
                  />
                </View>
              </View>

              {/* Custom permissions indicator and reset button */}
              {isCustomPermissions && (
                <TouchableOpacity
                  style={[styles.resetPermissionsButton, { borderColor: colors.gray300 }]}
                  onPress={handleResetToDefaults}
                  disabled={isSavingPermissions}
                >
                  <RefreshCw size={16} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.resetPermissionsText, { color: colors.gray600 }]}>
                    Permissions personnalisées • Réinitialiser aux valeurs par défaut
                  </Text>
                </TouchableOpacity>
              )}

              {isSavingPermissions && (
                <View style={styles.savingOverlay}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
            </>
          )}
        </View>

        {/* Answers to membership questions */}
        {member?.answers && member.answers.length > 0 && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Réponses à l'adhésion</Text>
            {member.answers.map((answer, index) => (
              <View
                key={index}
                style={[
                  styles.answerItem,
                  index > 0 && { borderTopColor: colors.gray200, borderTopWidth: 1, paddingTop: SPACING.md, marginTop: SPACING.md }
                ]}
              >
                <Text style={[styles.answerQuestion, { color: colors.gray600 }]}>
                  {answer.question || `Question ${index + 1}`}
                </Text>
                <Text style={[styles.answerText, { color: colors.textPrimary }]}>
                  {answer.answer}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Current Status with Picker */}
        {member?.status && (
          <View style={[styles.section, { borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Statut du membre</Text>

            {/* Current status display */}
            <View style={[styles.currentStatusDisplay, { backgroundColor: withOpacity(colors[STATUS_FLOW[member.status]?.colorKey || 'warning'], OPACITY[10]) }]}>
              {(() => {
                const config = STATUS_CONFIG[member.status] || STATUS_CONFIG.PENDING;
                const StatusIcon = config.icon;
                return <StatusIcon size={20} color={colors[STATUS_FLOW[member.status]?.colorKey || 'warning']} strokeWidth={ICON.strokeWidth} />;
              })()}
              <Text style={[styles.currentStatusDisplayText, { color: colors[STATUS_FLOW[member.status]?.colorKey || 'warning'] }]}>
                {STATUS_FLOW[member.status]?.label || member.status}
              </Text>
            </View>

            {/* Status picker */}
            <TouchableOpacity
              style={[styles.statusPickerButton, { borderColor: colors.gray300, backgroundColor: colors.gray100 }]}
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

            {/* Status options */}
            {showStatusPicker && (
              <View style={[styles.statusOptions, { borderColor: colors.gray200, backgroundColor: colors.surface }]}>
                {(Object.keys(STATUS_FLOW) as MemberStatus[])
                  .filter(status => status !== member.status)
                  .map((status) => {
                    const config = STATUS_CONFIG[status];
                    const flow = STATUS_FLOW[status];
                    const Icon = config.icon;

                    return (
                      <TouchableOpacity
                        key={status}
                        style={[styles.statusOption, { borderBottomColor: colors.gray200, backgroundColor: colors.surface }]}
                        onPress={() => {
                          if (status === 'REJECTED') {
                            Alert.prompt(
                              'Refuser le membre',
                              'Indiquez une raison (optionnel) :',
                              [
                                { text: 'Annuler', style: 'cancel' },
                                {
                                  text: 'Refuser',
                                  style: 'destructive',
                                  onPress: (reason) => handleUpdateStatus(status, reason),
                                },
                              ],
                              'plain-text'
                            );
                          } else {
                            handleUpdateStatus(status);
                          }
                        }}
                      >
                        <View style={[styles.statusOptionIcon, { backgroundColor: withOpacity(colors[config.colorKey], OPACITY[15]) }]}>
                          <Icon size={16} color={colors[config.colorKey]} strokeWidth={ICON.strokeWidth} />
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

        {/* Rejection reason if rejected */}
        {member?.status === 'REJECTED' && member.rejection_reason && (
          <View style={[styles.section, { backgroundColor: withOpacity(colors.error, OPACITY[10]), borderColor: withOpacity(colors.error, OPACITY[30]) }]}>
            <Text style={[styles.sectionTitle, { color: colors.error }]}>Raison du refus</Text>
            <Text style={[styles.rejectionReason, { color: colors.textPrimary }]}>
              {member.rejection_reason}
            </Text>
          </View>
        )}

        {/* Meta info */}
        <View style={[styles.section, { borderColor: colors.gray200 }]}>
          <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Informations de demande</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: colors.gray500 }]}>Date de demande:</Text>
            <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
              {formatDate(member?.created_at)}
            </Text>
          </View>
          {member?.joined_at && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.gray500 }]}>Membre depuis:</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                {formatDate(member.joined_at)}
              </Text>
            </View>
          )}
          {member?.accepted_rules && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: colors.gray500 }]}>Règles acceptées:</Text>
              <CheckCircle2 size={16} color={colors.success} strokeWidth={ICON.strokeWidth} />
            </View>
          )}
        </View>

        {/* Delete member */}
        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: colors.error }]}
          onPress={handleDeleteMember}
        >
          <Trash2 size={18} color={colors.error} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.deleteButtonText, { color: colors.error }]}>
            Supprimer ce membre
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  const renderAnswersTab = () => {
    const answers = member?.answers || [];
    const questions = member?.community?.application_questions || [];

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {answers.length === 0 ? (
          <View style={styles.noContent}>
            <Text style={[styles.noContentText, { color: colors.gray500 }]}>
              Aucune réponse fournie
            </Text>
          </View>
        ) : (
          answers.map((answer, index) => (
            <View key={index} style={[styles.answerCard, { backgroundColor: colors.surface, borderColor: colors.gray200 }]}>
              <Text style={[styles.answerQuestion, { color: colors.gray600 }]}>
                {answer.question || `Question ${index + 1}`}
              </Text>
              <Text style={[styles.answerText, { color: colors.textPrimary }]}>
                {answer.answer}
              </Text>
            </View>
          ))
        )}

        {/* Community rules if available */}
        {member?.community?.rules && (
          <View style={[styles.rulesCard, { backgroundColor: colors.gray50, borderColor: colors.gray200 }]}>
            <Text style={[styles.sectionTitle, { color: colors.gray700 }]}>Règles de la communauté</Text>
            <Text style={[styles.rulesText, { color: colors.textSecondary }]}>
              {member.community.rules}
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  const renderMessagesTab = () => {
    if (isLoadingMessages) {
      return (
        <View style={styles.loadingMessages}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    return (
      <View style={styles.messagesContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: keyboardHeight > 0 ? SPACING.md : SPACING.lg },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (keyboardHeight > 0) {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }
          }}
        >
          {messages.length === 0 ? (
            <View style={styles.noMessages}>
              <MessageCircle size={48} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.noMessagesTitle, { color: colors.textPrimary }]}>
                Démarrer la conversation
              </Text>
              <Text style={[styles.noMessagesText, { color: colors.gray500 }]}>
                Envoyez un message au membre pour commencer à discuter.
              </Text>
            </View>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                content={message.content}
                isMe={message.sender_type === 'ORGANIZATION'}
                senderName={message.sender_type === 'TALENT' ? (message.sender_name || member?.talent?.first_name || 'Membre') : undefined}
                createdAt={message.created_at}
                proposedDatetime={message.proposed_datetime}
                datetimeType={message.datetime_type}
                attachments={message.attachments}
              />
            ))
          )}
        </ScrollView>

        {/* Message Input */}
        <ChatInput
          onSend={handleSendMessage}
          isSending={isSending}
          placeholder="Écrivez votre message..."
          showDatetimeOption={true}
        />
      </View>
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

  if (!member) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
          Membre non trouvé
        </Text>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[member.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;
  const statusColor = colors[statusConfig.colorKey];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={[styles.statusBadge, { backgroundColor: withOpacity(statusColor, OPACITY[15]) }]}>
            <StatusIcon size={14} color={statusColor} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.gray200 }]}>
        {renderTab('profile', 'Profil')}
        {renderTab('messages', 'Messages')}
        {renderTab('notes', 'Notes')}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.contentContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'messages' && renderMessagesTab()}
        {activeTab === 'notes' && renderNotesTab()}
      </KeyboardAvoidingView>

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

  rejectionReason: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },

  metaLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  metaValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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

  noContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    minHeight: 200,
  },

  noContentText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  answerCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    marginBottom: SPACING.md,
  },

  answerQuestion: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  answerText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: 22,
  },

  rulesCard: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    marginTop: SPACING.md,
  },

  rulesText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },

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

  // Content container for keyboard avoiding
  contentContainer: {
    flex: 1,
  },

  // Messages styles
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

  // Answer item in profile
  answerItem: {
    marginBottom: SPACING.sm,
  },

  // Permissions styles
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },

  adminBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER.radius.full,
  },

  adminBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  permissionInfo: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
  },

  permissionInfoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },

  permissionsList: {
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
  },

  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },

  permissionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },

  permissionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  permissionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  permissionDesc: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  resetPermissionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER.radius.sm,
    borderStyle: 'dashed',
  },

  resetPermissionsText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
