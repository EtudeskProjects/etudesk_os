import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Share,
  MapPin,
  Wifi,
  Plane,
  Calendar,
  CheckCircle,
  Send,
  Edit3,
  X,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useSpace } from '../../../src/contexts/SpaceContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { Button, FooterNav, Alert } from '../../../src/components/ui';
import { formatRelativeTime } from '../../../src/utils/date';
import { talentService } from '../../../src/services/talentService';
import { opportunityService } from '../../../src/services/opportunityService';
import { opportunityInvitationService } from '../../../src/services/opportunityInvitationService';
import { SECTOR_DATA, PROFILE_TAG_DATA, GOAL_DATA } from '../../../src/constants/talent';
import type { Talent, Opportunity } from '../../../src/types/models';

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getLabelFromData = (id: string, data: Array<{ id: string; label: string }>): string => {
  return data.find((item) => item.id === id)?.label || id;
};

const INVITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

export default function TalentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { isOrganizationSpace, selectedOrgId, selectedOrg } = useSpace();
  const { user } = useAuth();

  // Talent data
  const [talent, setTalent] = useState<Talent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Alert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ type: 'success' | 'error'; title: string; message: string }>({
    type: 'success',
    title: '',
    message: '',
  });

  const isSelf = user?.id === talent?.id;
  const canInvite =
    isOrganizationSpace &&
    selectedOrg &&
    INVITE_ROLES.includes(selectedOrg.role) &&
    !isSelf;

  // Fetch talent
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await talentService.getTalent(id);
        if (res.data) {
          setTalent(res.data);
        } else {
          setError('Talent introuvable');
        }
      } catch {
        setError('Erreur lors du chargement du profil');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Load org opportunities when modal opens
  const openInviteModal = useCallback(async () => {
    if (!selectedOrgId) return;
    setInviteModalVisible(true);
    setSelectedOpportunityId(null);
    setLoadingOpportunities(true);
    try {
      const res = await opportunityService.getByOrganization(selectedOrgId, { status: 'OPEN' });
      setOpportunities(res.data || []);
    } catch {
      setOpportunities([]);
    } finally {
      setLoadingOpportunities(false);
    }
  }, [selectedOrgId]);

  const handleSendInvitation = useCallback(async () => {
    if (!selectedOpportunityId || !talent) return;
    setSending(true);
    try {
      const res = await opportunityInvitationService.sendInvitations(selectedOpportunityId, [
        { email: talent.email, name: talent.display_name },
      ]);
      setInviteModalVisible(false);
      if (res.data && res.data.sent > 0) {
        setAlertConfig({
          type: 'success',
          title: 'Invitation envoyée',
          message: `${talent.display_name} a été invité(e) à postuler.`,
        });
      } else {
        const errorMsg = res.data?.errors?.[0]?.error || 'Une erreur est survenue';
        setAlertConfig({
          type: 'error',
          title: 'Échec de l\'invitation',
          message: errorMsg,
        });
      }
      setAlertVisible(true);
    } catch {
      setInviteModalVisible(false);
      setAlertConfig({
        type: 'error',
        title: 'Erreur',
        message: 'Impossible d\'envoyer l\'invitation. Veuillez réessayer.',
      });
      setAlertVisible(true);
    } finally {
      setSending(false);
    }
  }, [selectedOpportunityId, talent]);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !talent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {error || 'Talent introuvable'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const createdAt = talent.created_at ? formatRelativeTime(talent.created_at) : null;
  const skills: Array<{ name: string; type?: string }> =
    Array.isArray(talent.skills)
      ? talent.skills.map((s: any) => typeof s === 'string' ? { name: s } : s)
      : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.gray100 }]}>
          <Share size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentPadded}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            {talent.avatar_url ? (
              <Image source={{ uri: talent.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={[styles.avatarPlaceholderText, { color: colors.textOnPrimary }]}>
                  {getInitials(talent.display_name)}
                </Text>
              </View>
            )}

            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.textPrimary }]}>
                {talent.display_name}
              </Text>
              {talent.verification_status === 'VERIFIED' && (
                <CheckCircle size={ICON.size.lg} color={colors.success} fill={colors.success} strokeWidth={0} />
              )}
            </View>

            {/* Profile Tags */}
            {talent.profile_tags && talent.profile_tags.length > 0 && (
              <View style={styles.profileTagsRow}>
                {talent.profile_tags.map((tag, index) => (
                  <View
                    key={index}
                    style={[styles.profileTag, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}
                  >
                    <Text style={[styles.profileTagText, { color: colors.primary }]}>
                      {getLabelFromData(tag, PROFILE_TAG_DATA)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Location + Preferences */}
          {(talent.city || talent.country || talent.remote_ready || talent.willing_to_relocate) && (
            <View style={styles.preferencesRow}>
              {(talent.city || talent.country) && (
                <View style={styles.preferenceItem}>
                  <MapPin size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.preferenceText, { color: colors.textSecondary }]}>
                    {[talent.city, talent.country].filter(Boolean).join(', ')}
                  </Text>
                </View>
              )}
              {talent.remote_ready && (
                <View style={styles.preferenceItem}>
                  <Wifi size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.preferenceText, { color: colors.textSecondary }]}>
                    Disponible en remote
                  </Text>
                </View>
              )}
              {talent.willing_to_relocate && (
                <View style={styles.preferenceItem}>
                  <Plane size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.preferenceText, { color: colors.textSecondary }]}>
                    Ouvert à la relocalisation
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Info Card */}
          {createdAt && (
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              <View style={styles.infoCardRow}>
                <Calendar size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View style={styles.infoCardContent}>
                  <Text style={[styles.infoCardLabel, { color: colors.textSecondary }]}>Sur Etudesk depuis</Text>
                  <Text style={[styles.infoCardValue, { color: colors.textPrimary }]}>{createdAt}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Bio */}
          {talent.bio && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>À propos</Text>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>{talent.bio}</Text>
            </View>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Compétences</Text>
              <View style={styles.tagsContainer}>
                {skills.map((skill, index) => (
                  <View key={index} style={[styles.tag, { backgroundColor: colors.gray100 }]}>
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                      {typeof skill === 'string' ? skill : skill.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Sectors */}
          {talent.sectors && talent.sectors.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Secteurs d'intérêt</Text>
              <View style={styles.tagsContainer}>
                {talent.sectors.map((sector, index) => (
                  <View key={index} style={[styles.tag, { backgroundColor: colors.gray100 }]}>
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                      {getLabelFromData(sector, SECTOR_DATA)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Goals */}
          {talent.goals && talent.goals.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Objectifs</Text>
              <View style={styles.tagsContainer}>
                {talent.goals.map((goal, index) => (
                  <View key={index} style={[styles.tag, { backgroundColor: colors.gray100 }]}>
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                      {getLabelFromData(goal, GOAL_DATA)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Languages */}
          {talent.languages && talent.languages.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Langues</Text>
              <View style={styles.tagsContainer}>
                {talent.languages.map((lang: any, index: number) => {
                  const label = typeof lang === 'string' ? lang : lang.language;
                  return (
                    <View key={index} style={[styles.tag, { backgroundColor: colors.gray100 }]}>
                      <Text style={[styles.tagText, { color: colors.textSecondary }]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        {isSelf && (
          <View style={styles.ctaContainer}>
            <Button
              title="Modifier mon profil"
              onPress={() => router.push('/settings/profile' as any)}
              icon={<Edit3 size={ICON.size.sm} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
              fullWidth
            />
          </View>
        )}
        {canInvite && (
          <View style={styles.ctaContainer}>
            <Button
              title="Inviter à une opportunité"
              onPress={openInviteModal}
              icon={<Send size={ICON.size.sm} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
              fullWidth
            />
          </View>
        )}
        <FooterNav activeTab="explore" />
      </View>

      {/* Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Inviter à une opportunité
              </Text>
              <TouchableOpacity
                onPress={() => setInviteModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Sélectionnez une opportunité pour inviter {talent.display_name}
            </Text>

            {/* Opportunity List */}
            {loadingOpportunities ? (
              <View style={styles.modalCentered}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : opportunities.length === 0 ? (
              <View style={styles.modalCentered}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Aucune opportunité ouverte
                </Text>
              </View>
            ) : (
              <FlatList
                data={opportunities}
                keyExtractor={(item) => item.id}
                style={styles.opportunityList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = selectedOpportunityId === item.id;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.opportunityItem,
                        {
                          borderColor: isSelected ? colors.primary : colors.borderColor,
                          backgroundColor: isSelected
                            ? withOpacity(colors.primary, OPACITY[8])
                            : colors.surface,
                        },
                      ]}
                      onPress={() => setSelectedOpportunityId(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.opportunityTitle,
                          { color: isSelected ? colors.primary : colors.textPrimary },
                        ]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      {item.type && (
                        <View style={[styles.opportunityBadge, { backgroundColor: colors.gray100 }]}>
                          <Text style={[styles.opportunityBadgeText, { color: colors.textSecondary }]}>
                            {item.type}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {/* Confirm Button */}
            <View style={styles.modalFooter}>
              <Button
                title="Confirmer l'invitation"
                onPress={handleSendInvitation}
                disabled={!selectedOpportunityId || sending}
                loading={sending}
                fullWidth
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Alert */}
      <Alert
        visible={alertVisible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  contentPadded: {
    paddingHorizontal: SPACING.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: 'center',
  },

  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: SPACING.md,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarPlaceholderText: {
    fontSize: TYPOGRAPHY.fontSize.xxxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  name: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
  },
  profileTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  profileTag: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },
  profileTagText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Preferences
  preferencesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  preferenceText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Info Card
  infoCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  infoCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  infoCardValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: 2,
  },

  // Sections
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },
  sectionText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * 1.6,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  tag: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },
  tagText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Footer
  footer: {},
  ctaContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '70%',
    borderTopLeftRadius: BORDER.radius.lg,
    borderTopRightRadius: BORDER.radius.lg,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  modalSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.md,
  },
  modalCentered: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },
  opportunityList: {
    maxHeight: 300,
  },
  opportunityItem: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.sm,
  },
  opportunityTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },
  opportunityBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER.radius.xs,
  },
  opportunityBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  modalFooter: {
    marginTop: SPACING.md,
  },
});
