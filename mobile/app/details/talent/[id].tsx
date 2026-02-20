import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  Pressable,
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
  Heart,
  Tag,
  Users,
  Check,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Code,
  BookOpen,
} from 'lucide-react-native';
	import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, COMPONENT } from '../../../src/constants/theme';
	import { useTheme } from '../../../src/hooks/useTheme';
	import { useSpace } from '../../../src/contexts/SpaceContext';
	import { useAuth } from '../../../src/contexts/AuthContext';
	import { Button, FooterNav, Alert, IconButton, IconTile, LoadingShimmer, SelectCard } from '../../../src/components/ui';
import { RemoteImage } from '../../../src/components/ui/RemoteImage';
import { formatRelativeTime } from '../../../src/utils/date';
import { talentService } from '../../../src/services/talentService';
import { opportunityService } from '../../../src/services/opportunityService';
import { opportunityInvitationService } from '../../../src/services/opportunityInvitationService';
import { communityInvitationService } from '../../../src/services/communityInvitationService';
import { spaceInvitationService } from '../../../src/services/spaceInvitationService';
import { communityService } from '../../../src/services/communityService';
import { spaceService } from '../../../src/services/spaceService';
import { orgTalentService, type OrgTagDefinition, applicationService, spaceBookingService } from '../../../src/services';
import { SECTOR_DATA, PROFILE_TAG_DATA, GOAL_DATA } from '../../../src/constants/talent';
import type { Talent, Opportunity, Application } from '../../../src/types/models';

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

// Skill type → base color + icon component (derive from current theme)
const getSkillTypeConfig = (colors: any): Record<string, { color: string; icon: typeof Code }> => ({
  HARD_SKILL: { color: colors.info, icon: Code },        // Savoir-faire
  SOFT_SKILL: { color: colors.success, icon: Users },    // Savoir-etre
  KNOWLEDGE: { color: colors.warning, icon: BookOpen },  // Savoir
});

// Proficiency → opacity multiplier for background gradient (darker = stronger)
const PROFICIENCY_BG_OPACITY: Record<string, number> = {
  BEGINNER: 0.08,
  INTERMEDIATE: 0.15,
  EXPERT: 0.25,
  MASTER: 0.38,
};

const SKILLS_PREVIEW_COUNT = 10;

const INVITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

export default function TalentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { isOrganizationSpace, selectedOrgId, selectedOrg } = useSpace();
  const { user } = useAuth();
  const SKILL_TYPE_CONFIG = getSkillTypeConfig(colors);

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

  // Org talent features
  const [isFavorite, setIsFavorite] = useState(false);
  const [orgTags, setOrgTags] = useState<OrgTagDefinition[]>([]);
  const [talentTagIds, setTalentTagIds] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [inviteType, setInviteType] = useState<'opportunity' | 'community' | 'space' | null>(null);
  const [communities, setCommunities] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);

  // Interactions
  const [talentApplications, setTalentApplications] = useState<Application[]>([]);
  const [talentCommunities, setTalentCommunities] = useState<any[]>([]);
  const [talentBookings, setTalentBookings] = useState<any[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);

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

  // Load org talent data (favorites, tags)
  useEffect(() => {
    if (!id || !isOrganizationSpace || !selectedOrgId) return;
    (async () => {
      try {
        const [favIds, tags] = await Promise.all([
          orgTalentService.getFavoriteIds(selectedOrgId),
          orgTalentService.getTags(selectedOrgId),
        ]);
        setIsFavorite(favIds.includes(id));
        setOrgTags(tags);
        // Fetch talent's assigned tags
        const talentRes = await orgTalentService.getTalents(selectedOrgId, { search: talent?.email, limit: 1 });
        const match = talentRes.talents.find((t: any) => t.talent_id === id);
        if (match) {
          setTalentTagIds(match.tags.map((t: any) => t.id));
        }
      } catch {
        // silently fail
      }
    })();
  }, [id, isOrganizationSpace, selectedOrgId, talent?.email]);

  // Load talent interactions with this org
  useEffect(() => {
    if (!id || !isOrganizationSpace || !selectedOrgId) return;
    (async () => {
      setLoadingInteractions(true);
      try {
        const [appsRes, bookingsRes, commsRes] = await Promise.allSettled([
          applicationService.getOrganizationApplications(selectedOrgId, { limit: 100 }),
          spaceBookingService.getOrganizationBookings(selectedOrgId, { talent_id: id, limit: 20 } as any),
          communityService.getByOrganization(selectedOrgId, { limit: 50, offset: 0 }),
        ]);

        // Applications: filter by talent_id
        if (appsRes.status === 'fulfilled') {
          const allApps = appsRes.value.data || [];
          setTalentApplications(allApps.filter((a: Application) => a.talent_id === id));
        }

        // Bookings: already filtered by talent_id
        if (bookingsRes.status === 'fulfilled') {
          setTalentBookings(bookingsRes.value.data || []);
        }

        // Communities: check each for talent membership
        if (commsRes.status === 'fulfilled') {
          const orgComms = commsRes.value.data || [];
          const memberChecks = await Promise.allSettled(
            orgComms.map((c: any) => communityService.getCommunityMembers(c.id, { limit: 200 }))
          );
          const matched = orgComms.filter((_: any, i: number) => {
            if (memberChecks[i].status !== 'fulfilled') return false;
            const res = (memberChecks[i] as PromiseFulfilledResult<any>).value;
            const members = res.data?.data || [];
            return members.some((m: any) => m.talent_id === id);
          });
          setTalentCommunities(matched);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingInteractions(false);
      }
    })();
  }, [id, isOrganizationSpace, selectedOrgId]);

  const handleToggleFavorite = useCallback(async () => {
    if (!id || !selectedOrgId) return;
    try {
      if (isFavorite) {
        await orgTalentService.unfavoriteTalent(selectedOrgId, id);
      } else {
        await orgTalentService.favoriteTalent(selectedOrgId, id);
      }
      setIsFavorite(!isFavorite);
    } catch {
      // silently fail
    }
  }, [id, selectedOrgId, isFavorite]);

  const handleToggleTag = useCallback(async (tagId: string) => {
    if (!id || !selectedOrgId) return;
    const hasTag = talentTagIds.includes(tagId);
    try {
      if (hasTag) {
        await orgTalentService.unassignTag(selectedOrgId, id, tagId);
        setTalentTagIds(prev => prev.filter(t => t !== tagId));
      } else {
        await orgTalentService.assignTag(selectedOrgId, id, tagId);
        setTalentTagIds(prev => [...prev, tagId]);
      }
    } catch {
      // silently fail
    }
  }, [id, selectedOrgId, talentTagIds]);

  const openInviteTypeModal = useCallback(async (type: 'opportunity' | 'community' | 'space') => {
    if (!selectedOrgId) return;
    setInviteType(type);
    setSelectedItemId(null);
    setLoadingItems(true);
    try {
      if (type === 'opportunity') {
        const res = await opportunityService.getByOrganization(selectedOrgId, { status: 'OPEN' });
        setOpportunities(res.data || []);
      } else if (type === 'community') {
        const res = await communityService.getByOrganization(selectedOrgId, { limit: 50, offset: 0 });
        setCommunities(res.data || []);
      } else if (type === 'space') {
        const res = await spaceService.getByOrganization(selectedOrgId, { limit: 50, offset: 0 });
        setSpaces(res.data || []);
      }
    } catch {
      setOpportunities([]);
      setCommunities([]);
      setSpaces([]);
    } finally {
      setLoadingItems(false);
    }
  }, [selectedOrgId]);

  const handleSendTypedInvitation = useCallback(async () => {
    if (!selectedItemId || !talent || !inviteType) return;
    setSending(true);
    try {
      const payload = [{ email: talent.email, name: talent.display_name }];
      let success = false;
      if (inviteType === 'opportunity') {
        const res = await opportunityInvitationService.sendInvitations(selectedItemId, payload);
        success = !!(res.data && res.data.sent > 0);
      } else if (inviteType === 'community') {
        const res = await communityInvitationService.sendInvitations(selectedItemId, payload);
        success = !!(res.data && res.data.sent > 0);
      } else if (inviteType === 'space') {
        const res = await spaceInvitationService.sendInvitations(selectedItemId, payload);
        success = !!(res.data && res.data.sent > 0);
      }
      setInviteType(null);
      const typeLabel = inviteType === 'opportunity' ? 'l\'opportunité' : inviteType === 'community' ? 'la communauté' : 'l\'espace';
      if (success) {
        setAlertConfig({ type: 'success', title: 'Invitation envoyée', message: `${talent.display_name} a été invité(e) à rejoindre ${typeLabel}.` });
      } else {
        setAlertConfig({ type: 'error', title: 'Échec', message: 'L\'invitation n\'a pas pu être envoyée.' });
      }
      setAlertVisible(true);
    } catch {
      setInviteType(null);
      setAlertConfig({ type: 'error', title: 'Erreur', message: 'Impossible d\'envoyer l\'invitation.' });
      setAlertVisible(true);
    } finally {
      setSending(false);
    }
  }, [selectedItemId, talent, inviteType]);

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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	        <View style={styles.header}>
	          <IconButton
	            onPress={() => router.back()}
	            icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	            accessibilityLabel="Retour"
	            variant="filled"
	            style={[styles.headerButton, { backgroundColor: colors.gray100, width: 44, height: 44 }]}
	          />
	        </View>
        <View style={styles.centered}>
          <LoadingShimmer variant="fullPage" />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !talent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	        <View style={styles.header}>
	          <IconButton
	            onPress={() => router.back()}
	            icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	            accessibilityLabel="Retour"
	            variant="filled"
	            style={[styles.headerButton, { backgroundColor: colors.gray100, width: 44, height: 44 }]}
	          />
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
  const skills: Array<{ name: string; type?: string; proficiency_level?: string }> =
    Array.isArray(talent.skills)
      ? talent.skills.map((s: any) => typeof s === 'string' ? { name: s } : s)
      : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Retour"
          variant="filled"
          style={[styles.headerButton, { backgroundColor: colors.gray100, width: 44, height: 44 }]}
        />
        <IconButton
          onPress={() => {}}
          icon={<Share size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel="Partager"
          variant="filled"
          disabled
          style={[styles.headerButton, { backgroundColor: colors.gray100, width: 44, height: 44 }]}
        />
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
              <RemoteImage uri={talent.avatar_url} style={styles.avatar} />
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
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Compétences ({skills.length})
              </Text>
              <View style={styles.tagsContainer}>
                {(showAllSkills ? skills : skills.slice(0, SKILLS_PREVIEW_COUNT)).map((skill, index) => {
                  const config = skill.type ? SKILL_TYPE_CONFIG[skill.type] : null;
                  const baseColor = config?.color || colors.gray500;
                  const SkillIcon = config?.icon || BookOpen;
                  const bgOpacity = skill.proficiency_level
                    ? (PROFICIENCY_BG_OPACITY[skill.proficiency_level] || 0.10)
                    : 0.10;
                  return (
                    <View
                      key={index}
                      style={[styles.skillPill, { backgroundColor: baseColor + Math.round(bgOpacity * 255).toString(16).padStart(2, '0') }]}
                    >
                      <SkillIcon size={COMPONENT.pill.iconSize} color={baseColor} strokeWidth={COMPONENT.pill.iconStrokeWidth} />
                      <Text style={[styles.skillPillText, { color: baseColor }]}>
                        {skill.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
	              {skills.length > SKILLS_PREVIEW_COUNT && (
	                <Button
	                  title={showAllSkills ? 'Voir moins' : `Voir plus (+${skills.length - SKILLS_PREVIEW_COUNT})`}
	                  onPress={() => setShowAllSkills(!showAllSkills)}
	                  variant="ghost"
	                  size="sm"
	                  icon={
	                    showAllSkills
	                      ? <ChevronUp size={16} color={colors.primary} strokeWidth={ICON.strokeWidth} />
	                      : <ChevronDown size={16} color={colors.primary} strokeWidth={ICON.strokeWidth} />
	                  }
	                  style={[styles.showMoreButton, { backgroundColor: 'transparent', paddingHorizontal: 0 }]}
	                  textStyle={[styles.showMoreText, { color: colors.primary }]}
	                />
	              )}
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

          {/* Interactions with organization */}
          {isOrganizationSpace && !loadingInteractions && (talentApplications.length > 0 || talentCommunities.length > 0 || talentBookings.length > 0) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Interactions</Text>

              {talentApplications.length > 0 && (
                <View style={styles.interactionGroup}>
                  <View style={styles.interactionHeader}>
                    <Briefcase size={16} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.interactionGroupTitle, { color: colors.textPrimary }]}>
                      Candidatures ({talentApplications.length})
                    </Text>
                  </View>
                  {talentApplications.map((app) => (
                    <View key={app.id} style={[styles.interactionItem, { backgroundColor: colors.gray100 }]}>
                      <View style={styles.interactionItemContent}>
                        <Text style={[styles.interactionItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {app.opportunity?.title || 'Opportunité'}
                        </Text>
                        {app.applied_at && (
                          <Text style={[styles.interactionItemDate, { color: colors.textTertiary }]}>
                            {formatRelativeTime(app.applied_at)}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.interactionBadge, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                        <Text style={[styles.interactionBadgeText, { color: colors.primary }]}>
                          {app.status}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {talentCommunities.length > 0 && (
                <View style={styles.interactionGroup}>
                  <View style={styles.interactionHeader}>
                    <Users size={16} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.interactionGroupTitle, { color: colors.textPrimary }]}>
                      Communautés ({talentCommunities.length})
                    </Text>
                  </View>
                  {talentCommunities.map((comm: any) => (
                    <View key={comm.id} style={[styles.interactionItem, { backgroundColor: colors.gray100 }]}>
                      <View style={styles.interactionItemContent}>
                        <Text style={[styles.interactionItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {comm.name || comm.title}
                        </Text>
                        {comm.joined_at && (
                          <Text style={[styles.interactionItemDate, { color: colors.textTertiary }]}>
                            {formatRelativeTime(comm.joined_at)}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.interactionBadge, { backgroundColor: withOpacity(colors.success, OPACITY[15]) }]}>
                        <Text style={[styles.interactionBadgeText, { color: colors.success }]}>
                          Membre
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {talentBookings.length > 0 && (
                <View style={styles.interactionGroup}>
                  <View style={styles.interactionHeader}>
                    <MapPin size={16} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[styles.interactionGroupTitle, { color: colors.textPrimary }]}>
                      Réservations ({talentBookings.length})
                    </Text>
                  </View>
                  {talentBookings.map((booking: any) => (
                    <View key={booking.id} style={[styles.interactionItem, { backgroundColor: colors.gray100 }]}>
                      <View style={styles.interactionItemContent}>
                        <Text style={[styles.interactionItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {booking.space?.name || booking.space?.title || 'Espace'}
                        </Text>
                        {(booking.start_date || booking.created_at) && (
                          <Text style={[styles.interactionItemDate, { color: colors.textTertiary }]}>
                            {formatRelativeTime(booking.start_date || booking.created_at)}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.interactionBadge, {
                        backgroundColor: withOpacity(
                          booking.status === 'CONFIRMED' ? colors.success : colors.warning,
                          OPACITY[15]
                        ),
                      }]}>
                        <Text style={[styles.interactionBadgeText, {
                          color: booking.status === 'CONFIRMED' ? colors.success : colors.warning,
                        }]}>
                          {booking.status}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {isOrganizationSpace && loadingInteractions && (
            <View style={[styles.section, { alignItems: 'center' }]}>
              <LoadingShimmer variant="inline" />
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
	          <View style={styles.actionBar}>
	            <IconTile
	              onPress={handleToggleFavorite}
	              selected={isFavorite}
	              selectedColor={colors.error}
	              icon={
	                <Heart
	                  size={20}
	                  color={isFavorite ? colors.error : colors.textSecondary}
	                  fill={isFavorite ? colors.error : 'transparent'}
	                  strokeWidth={ICON.strokeWidth}
	                />
	              }
	              label="Favoris"
	              style={styles.actionBarButton}
	              labelStyle={[styles.actionBarLabel, { color: isFavorite ? colors.error : colors.textSecondary }]}
	            />

	            <IconTile
	              onPress={() => setShowTagModal(true)}
	              icon={<Tag size={20} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
	              label="Catégories"
	              style={styles.actionBarButton}
	              labelStyle={[styles.actionBarLabel, { color: colors.textSecondary }]}
	            />

	            <IconTile
	              onPress={() => openInviteTypeModal('opportunity')}
	              icon={<Send size={20} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
	              label="Inviter"
	              style={styles.actionBarButton}
	              labelStyle={[styles.actionBarLabel, { color: colors.textSecondary }]}
	            />
	          </View>
	        )}
        <FooterNav activeTab="explore" />
      </View>

      {/* Tag Assignment Modal */}
      <Modal visible={showTagModal} transparent animationType="slide" onRequestClose={() => setShowTagModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowTagModal(false)} />
	          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
	            <View style={styles.modalHeader}>
	              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Catégories</Text>
	              <IconButton
	                onPress={() => setShowTagModal(false)}
	                icon={<X size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
	                accessibilityLabel="Fermer"
	              />
	            </View>
            {orgTags.length === 0 ? (
              <View style={styles.modalCentered}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Aucune catégorie créée
                </Text>
                <Text style={[styles.emptyText, { color: colors.gray400, marginTop: SPACING.xs }]}>
                  Créez des tags depuis l'écran Mes Talents
                </Text>
              </View>
            ) : (
              orgTags.map(tag => {
                const isAssigned = talentTagIds.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    style={[styles.tagAssignRow, { borderBottomColor: colors.gray100 }]}
                    onPress={() => handleToggleTag(tag.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Basculer catégorie ${tag.name}`}
                  >
                    <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                    <Text style={[styles.tagAssignName, { color: colors.textPrimary }]}>{tag.name}</Text>
                    <View style={[
                      styles.tagCheckbox,
                      { backgroundColor: isAssigned ? tag.color : 'transparent', borderColor: isAssigned ? tag.color : colors.gray300 },
                    ]}>
                      {isAssigned && <Check size={14} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </Modal>

      {/* Invite Modal (opportunity / community / space) */}
      <Modal visible={!!inviteType} transparent animationType="slide" onRequestClose={() => setInviteType(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setInviteType(null)} />
	          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
	            <View style={styles.modalHeader}>
	              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
	                Inviter {talent.display_name}
	              </Text>
	              <IconButton
	                onPress={() => setInviteType(null)}
	                icon={<X size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
	                accessibilityLabel="Fermer"
	              />
	            </View>

            {/* Type selector tabs */}
            <View style={styles.inviteTypeTabs}>
              {([
                { key: 'opportunity' as const, label: 'Opportunités', icon: Briefcase },
                { key: 'community' as const, label: 'Communautés', icon: Users },
                { key: 'space' as const, label: 'Espaces', icon: MapPin },
              ]).map(tab => {
                const isActive = inviteType === tab.key;
                const TabIcon = tab.icon;
                return (
                  <SelectCard
                    key={tab.key}
                    style={[
                      styles.inviteTypeTab,
                      { backgroundColor: isActive ? withOpacity(colors.primary, OPACITY[15]) : colors.gray100 },
                      { borderWidth: 0, borderColor: 'transparent' },
                    ]}
                    onPress={() => { setInviteType(tab.key); setSelectedItemId(null); openInviteTypeModal(tab.key); }}
                    selected={false}
                    accessibilityLabel={tab.label}
                  >
                    <TabIcon size={16} color={isActive ? colors.primary : colors.textSecondary} strokeWidth={ICON.strokeWidth} />
                    <Text style={[
                      styles.inviteTypeTabText,
                      { color: isActive ? colors.primary : colors.textSecondary },
                    ]}>
                      {tab.label}
                    </Text>
                  </SelectCard>
                );
              })}
            </View>

            {loadingItems ? (
              <View style={styles.modalCentered}>
                <LoadingShimmer variant="inline" />
              </View>
            ) : (() => {
              const items = inviteType === 'opportunity' ? opportunities : inviteType === 'community' ? communities : spaces;
              return items.length === 0 ? (
                <View style={styles.modalCentered}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {inviteType === 'opportunity' ? 'Aucune opportunité ouverte' : inviteType === 'community' ? 'Aucune communauté' : 'Aucun espace'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={items}
                  keyExtractor={(item) => item.id}
                  style={styles.opportunityList}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isSelected = selectedItemId === item.id;
                    return (
                      <SelectCard
                        style={[
                          styles.opportunityItem,
                          {
                            borderColor: isSelected ? colors.primary : colors.borderColor,
                            backgroundColor: isSelected ? withOpacity(colors.primary, OPACITY[8]) : colors.surface,
                          },
                        ]}
                        onPress={() => setSelectedItemId(item.id)}
                        selected={false}
                        accessibilityLabel={item.title || item.name}
                      >
                        <Text
                          style={[styles.opportunityTitle, { color: isSelected ? colors.primary : colors.textPrimary }]}
                          numberOfLines={2}
                        >
                          {item.title || item.name}
                        </Text>
                        {item.type && (
                          <View style={[styles.opportunityBadge, { backgroundColor: colors.gray100 }]}>
                            <Text style={[styles.opportunityBadgeText, { color: colors.textSecondary }]}>
                              {item.type}
                            </Text>
                          </View>
                        )}
                      </SelectCard>
                    );
                  }}
                />
              );
            })()}

            <View style={styles.modalFooter}>
              <Button
                title="Confirmer l'invitation"
                onPress={handleSendTypedInvitation}
                disabled={!selectedItemId || sending}
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
    borderRadius: BORDER.radius.lg,
    marginBottom: SPACING.md,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: BORDER.radius.lg,
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
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  profileTagText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
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
    gap: 4,
  },
  tag: {
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  tagText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },
  skillPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPONENT.pill.gap,
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  skillPillText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  showMoreText: {
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

  // Interactions
  interactionGroup: {
    marginBottom: SPACING.md,
  },
  interactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  interactionGroupTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  interactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.sm,
    marginBottom: SPACING.xs,
  },
  interactionItemContent: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  interactionItemTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  interactionItemDate: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  interactionBadge: {
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  interactionBadgeText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  actionBarButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.sm,
    gap: 4,
  },
  actionBarLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textAlign: 'center',
  },
  // Tag assignment
  tagAssignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  tagDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tagAssignName: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  tagCheckbox: {
    width: 24,
    height: 24,
    borderRadius: BORDER.radius.xs,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Invite type tabs
  inviteTypeTabs: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  inviteTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER.radius.sm,
  },
  inviteTypeTabText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
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
