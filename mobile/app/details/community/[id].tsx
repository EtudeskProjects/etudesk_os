import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Users,
  Globe,
  Share,
  Calendar,
  CheckCircle,
  Bookmark,
  Monitor,
  MapPin,
  ChevronRight,
  Eye,
  BookmarkCheck,
  PenSquare,
  BarChart2,
  Shield,
  Settings,
} from 'lucide-react-native';
	import { SPACING, TYPOGRAPHY, ICON, BORDER, OPACITY, withOpacity, COMPONENT } from '../../../src/constants/theme';
	import { useTheme } from '../../../src/hooks/useTheme';
	import { useI18n } from '../../../src/contexts/I18nContext';
	import { useSpace } from '../../../src/contexts/SpaceContext';
	import { Button, IconButton, ImageSlider, FooterNav, FloatingActionMenu, ActionItem, TabBar, SelectCard, LoadingShimmer } from '../../../src/components/ui';
import { ActivityFeed } from '../../../src/components/community/ActivityFeed';
import { EntitySkillTags } from '../../../src/components/EntitySkillTags';
import { formatRelativeTime, formatDate } from '../../../src/utils/date';
import { getFullImageUrl } from '../../../src/utils/image';
import { formatNumberNoTrailingZeros } from '../../../src/utils/number';
import type { Community, CommunityMemberPreview } from '../../../src/types/models';
import {
  getOrganizationTypeLabel,
} from '../../../src/types/models';
import { communityService, bookmarkService, MembershipStatus } from '../../../src/services';
import { useAlert } from '../../../src/contexts/AlertContext';

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentSpace, selectedOrg } = useSpace();

  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [activeTab, setActiveTab] = useState<'presentation' | 'activities' | 'members'>('presentation');
  const [membersPreview, setMembersPreview] = useState<CommunityMemberPreview[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const alerts = useAlert();

  // Only show manage button if owner AND connected as organization
  const canManageCommunity = isOwner && currentSpace === 'organization';

  useEffect(() => {
    loadCommunity();
    checkMembership();
  }, [id]);

  // Reload community when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      loadCommunity();
      checkMembership();
    }, [id])
  );

  // Scroll to top when tab changes
  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [activeTab]);

  const loadCommunity = async () => {
    try {
      setIsLoading(true);
      const response = await communityService.getById(id!);
      if (response.data) {
        setCommunity(response.data);
        // Check if the current organization owns this community
        if (selectedOrg && response.data.organization_id === selectedOrg.id) {
          setIsOwner(true);
        } else {
          setIsOwner(false);
        }

      }
    } catch (error: any) {
      if (__DEV__) console.error('Error loading community:', error);
      void alerts.alert(t('common.error'), t('community.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const checkMembership = async () => {
    try {
      const response = await communityService.checkMembership(id!);
      if (response.data) {
        setMembershipStatus(response.data);
      }
    } catch (error) {
      // User might not be logged in, ignore error
    }
  };

  const loadMembers = useCallback(async () => {
    if (!id) return;
    setMembersLoading(true);
    try {
      const res = await communityService.getCommunityMembers(id, { limit: 100, status: 'ACTIVE' });
      const list = Array.isArray(res?.data) ? res.data : (res as any)?.data ?? [];
      const preview: CommunityMemberPreview[] = list.map((row: any) => {
        const t = row.talent || {};
        const displayName = [t.first_name, t.last_name].filter(Boolean).join(' ').trim() || t.email || '';
        return {
          id: t.id || row.id,
          display_name: displayName,
          avatar_url: t.avatar_url,
          role: row.role,
          city: t.city,
          country: t.country,
          bio: t.bio,
          joined_at: row.joined_at,
        };
      });
      setMembersPreview(preview);
    } catch (e) {
      if (__DEV__) console.error('Error loading members:', e);
      setMembersPreview([]);
    } finally {
      setMembersLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id && community && membersPreview.length === 0 && !membersLoading) {
      loadMembers();
    }
  }, [id, community, loadMembers, membersLoading, membersPreview.length]);

  const toggleBookmark = async () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleJoin = () => {
    if (membershipStatus?.is_member) {
      // Already a member - could navigate to community feed/chat
      void alerts.alert(t('common.information'), t('community.alreadyMember'));
    } else if (membershipStatus?.has_pending_request) {
      // Cancel pending request
      void alerts.showAlert({ title: t('community.cancelRequestTitle'), message: t('community.cancelRequestConfirm'), buttons: [
          { text: t('common.no'), style: 'cancel' },
          {
            text: t('community.cancelRequestYes'),
            style: 'destructive',
            onPress: async () => {
              try {
                await communityService.cancelRequest(id as string);
                setMembershipStatus(prev => prev ? { ...prev, has_pending_request: false } : null);
                void alerts.alert(t('common.success'), t('community.requestCancelled'));
              } catch (error) {
                void alerts.alert(t('common.error'), t('community.cancelRequestError'));
              }
            },
          },
        ] });
    } else {
      // Navigate to join flow
      router.push(`/details/community/join/${id}`);
    }
  };

  const getButtonText = () => {
    if (membershipStatus?.is_member) {
      return t('community.joined');
    }
    if (membershipStatus?.has_pending_request) {
      return t('community.cancelRequest');
    }
    return t('community.joinCommunity');
  };

  const getButtonVariant = (): 'primary' | 'outline' => {
    if (membershipStatus?.is_member || membershipStatus?.has_pending_request) {
      return 'outline';
    }
    return 'primary';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <LoadingShimmer variant="fullPage" />
        </View>
      </SafeAreaView>
    );
  }

  if (!community) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textPrimary }}>{t('community.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tags = community.tags || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	      {/* Header */}
	      <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
	        <IconButton
	          onPress={() => router.back()}
	          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	          accessibilityLabel={t('common.back')}
	          variant="filled"
	          style={[styles.headerButton, { backgroundColor: colors.gray100, width: 44, height: 44 }]}
	        />
	        <View style={styles.headerActions}>
	          <IconButton
	            onPress={() => {}}
	            icon={<Share size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	            accessibilityLabel={t('common.share')}
	            variant="filled"
	            disabled
	            style={[styles.headerButton, { backgroundColor: colors.gray100, width: 44, height: 44 }]}
	          />
		          <IconButton
		            onPress={toggleBookmark}
		            icon={
		              isBookmarked ? (
		                <BookmarkCheck size={ICON.size.md} color={colors.primary} fill={colors.primary} strokeWidth={ICON.strokeWidth} />
		              ) : (
		                <Bookmark size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
		              )
		            }
		            accessibilityLabel={isBookmarked ? t('common.removeFromFavorites') : t('common.addToFavorites')}
		            variant="filled"
		            style={[
		              styles.headerButton,
	              { backgroundColor: isBookmarked ? withOpacity(colors.primary, OPACITY[15]) : colors.gray100, width: 44, height: 44 },
	            ]}
	          />
	        </View>
	      </View>

      {(activeTab as string) !== 'activities' && (
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Slider */}
        <View style={styles.sliderContainer}>
          <ImageSlider
            images={(() => {
              // Prioritize images array if it has items, otherwise use cover_image_url
              const imageList = community.images && community.images.length > 0
                ? community.images
                : (community.cover_image_url ? [community.cover_image_url] : []);
              return imageList.map(img => getFullImageUrl(img) || '').filter(Boolean);
            })()}
            height={220}
          />
        </View>

	        <View style={styles.contentPadded}>
          {/* Organization Card */}
	          {community.organization?.id && (
	            <SelectCard
	              accessibilityLabel={t('common.viewOrganization', { name: community.organization.name })}
	              style={[styles.orgCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
	              onPress={() => router.push(`/details/organization/${community.organization!.id}`)}
	            >
              {community.organization.logo_url ? (
                <Image source={{ uri: getFullImageUrl(community.organization.logo_url) || '' }} style={styles.orgLogo} />
              ) : (
                <View style={[styles.orgLogoPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={styles.orgLogoText}>
                    {getInitials(community.organization.name || '')}
                  </Text>
                </View>
              )}
              <View style={styles.orgInfo}>
                <View style={styles.orgNameRow}>
                  <Text style={[styles.orgName, { color: colors.textPrimary }]}>
                    {community.organization.name}
                  </Text>
                  {community.organization.verification_status === 'VERIFIED' && (
                    <CheckCircle size={ICON.size.sm} color={colors.success} fill={colors.success} strokeWidth={0} />
                  )}
                </View>
                <View style={styles.orgTagsRow}>
                  {community.organization.type && (
                    <View style={[styles.orgTag, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                      <Text style={[styles.orgTagText, { color: colors.primary }]}>
                        {getOrganizationTypeLabel(community.organization.type) || community.organization.type}
                      </Text>
                    </View>
                  )}
                  {community.organization.headquarters_city && (
                    <Text style={[styles.orgLocation, { color: colors.textSecondary }]}>
                      {community.organization.headquarters_city}{community.organization.headquarters_country ? `, ${community.organization.headquarters_country}` : ''}
                    </Text>
                  )}
                </View>
              </View>
              <ChevronRight size={ICON.size.sm} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
	            </SelectCard>
	          )}

          {/* Title */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {community.name}
          </Text>

          {/* Tags Row */}
          <View style={styles.tagsRow}>
            {community.type && (
              <View style={[styles.tag, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                {community.type === 'ONLINE' ? (
                  <Monitor size={COMPONENT.pill.iconSize} color={colors.primary} strokeWidth={COMPONENT.pill.iconStrokeWidth} />
                ) : community.type === 'HYBRID' ? (
                  <MapPin size={COMPONENT.pill.iconSize} color={colors.primary} strokeWidth={COMPONENT.pill.iconStrokeWidth} />
                ) : (
                  <Globe size={COMPONENT.pill.iconSize} color={colors.primary} strokeWidth={COMPONENT.pill.iconStrokeWidth} />
                )}
                <Text style={[styles.tagText, { color: colors.primary, marginLeft: 4 }]}>
                  {community.type === 'ONLINE' ? t('community.types.online') : community.type === 'HYBRID' ? t('community.types.hybrid') : t('community.types.offline')}
                </Text>
              </View>
            )}
          </View>

	          {/* Tab Navigation - Only visible for members */}
	          {membershipStatus?.is_member && (
	            <TabBar
	              tabs={[
	                { key: 'presentation', label: t('community.presentation'), icon: PenSquare },
	                { key: 'activities', label: t('community.activities'), icon: BarChart2, count: community.activities_count || 0 },
	                { key: 'members', label: t('community.members'), icon: Users, count: community.members_count || 0 },
	              ]}
	              activeTab={activeTab}
	              onTabChange={(key) => setActiveTab(key as any)}
	            />
	          )}
	        </View>

        {/* Content based on active tab */}
        {activeTab === 'presentation' && (
          <View style={[styles.contentPadded, styles.tabContent]}>
            {/* Meta Info Card */}
            <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
              {/* Members */}
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Users size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  <View>
                    <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('community.members')}</Text>
                    <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                      {formatNumberNoTrailingZeros(community.members_count || 0, 0)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Location + Created date */}
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <MapPin size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  <View>
                    <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('community.location')}</Text>
                    <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                      {community.type === 'ONLINE'
                        ? t('community.types.online')
                        : [community.city, community.country].filter(Boolean).join(', ') || t('common.notSpecified')}
                    </Text>
                  </View>
                </View>
                <View style={styles.metaItem}>
                  <Calendar size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  <View>
                    <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('community.createdAt')}</Text>
                    <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                      {community.created_at ? formatDate(community.created_at) : '-'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Tags/Categories Section */}
            {tags.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('community.tags')}</Text>
                <View style={styles.categoriesRow}>
                  {tags.map((tag, index) => (
                    <View key={index} style={[styles.categoryTag, { backgroundColor: withOpacity(colors.primary, OPACITY[10]) }]}>
                      <Text style={[styles.categoryTagText, { color: colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* About Section */}
            {community.description && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('community.about')}</Text>
                <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                  {community.description}
                </Text>
              </View>
            )}

            {/* Catalog skill tags the community validates */}
            <EntitySkillTags skills={community.skills} title={t('community.skills')} showRequirement={false} />

            {/* Members Preview */}
	            {membersPreview.length > 0 && (
	              <View style={styles.section}>
	                <View style={styles.sectionHeader}>
	                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('community.members')}</Text>
	                  <Button
	                    title={t('common.seeAll')}
	                    onPress={() => setActiveTab('members')}
	                    variant="ghost"
	                    size="sm"
	                    style={{ paddingHorizontal: 0, backgroundColor: 'transparent' } as any}
	                    textStyle={[styles.seeAllText, { color: colors.primary }]}
	                  />
	                </View>
                <View style={styles.membersList}>
                  {membersPreview.slice(0, 5).map((member) => (
                    <View key={member.id} style={styles.memberAvatarContainer}>
                      {member.avatar_url ? (
                        <Image
                          source={{ uri: getFullImageUrl(member.avatar_url) || '' }}
                          style={[styles.memberAvatar, { borderColor: colors.background }]}
                        />
                      ) : (
                        <View style={[styles.memberAvatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]), borderColor: colors.background }]}>
                          <Text style={[styles.memberAvatarText, { color: colors.primary }]}>
                            {getInitials(member.display_name || '')}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                  {(community.members_count ?? membersPreview.length) > 5 && (
                    <View style={[styles.moreMembersCircle, { backgroundColor: colors.gray100, borderColor: colors.background }]}>
                      <Text style={[styles.moreMembersText, { color: colors.textSecondary }]}>+{formatNumberNoTrailingZeros((community.members_count ?? membersPreview.length) - 5, 0)}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}


          </View>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <View style={styles.contentPadded}>
            <View style={styles.tabContent}>
              {/* Members List */}
              {membersLoading ? (
                <View style={[styles.membersListContainer, styles.loadingContainer, { backgroundColor: colors.surface, minHeight: 120 }]}>
                  <LoadingShimmer variant="inline" />
                </View>
              ) : membersPreview.length > 0 ? (
                <View style={[styles.membersListContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
	                  {membersPreview.map((member, index) => (
	                    <View
	                      key={member.id}
	                      style={[
	                        styles.memberItem,
                        {
                          borderBottomColor: colors.borderColor,
                          backgroundColor: colors.surface,
                          borderBottomWidth: index < membersPreview.length - 1 ? BORDER.width.thin : 0
                        }
	                      ]}
	                    >
                      {member.avatar_url ? (
                        <Image
                          source={{ uri: getFullImageUrl(member.avatar_url) || '' }}
                          style={styles.memberItemAvatar}
                        />
                      ) : (
                        <View style={[styles.memberItemAvatarPlaceholder, { backgroundColor: withOpacity(colors.primary, OPACITY[20]) }]}>
                          <Text style={[styles.memberItemAvatarText, { color: colors.primary }]}>
                            {getInitials(member.display_name || '')}
                          </Text>
                        </View>
                      )}
                        <View style={styles.memberItemInfo}>
                        <View style={styles.memberItemNameRow}>
                          <Text style={[styles.memberItemName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {member.display_name || t('community.joined')}
                          </Text>
                          {member.role === 'ADMIN' && (
                            <View style={[styles.adminBadge, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                              <Shield size={COMPONENT.pill.iconSize} color={colors.primary} strokeWidth={COMPONENT.pill.iconStrokeWidth} />
                              <Text style={[styles.adminBadgeText, { color: colors.primary }]}>Admin</Text>
                            </View>
                          )}
                        </View>
                        {/* Location */}
                        {(member.city || member.country) && (
                          <View style={styles.memberItemLocation}>
                            <MapPin size={12} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
                            <Text style={[styles.memberItemLocationText, { color: colors.textSecondary }]} numberOfLines={1}>
                              {[member.city, member.country].filter(Boolean).join(', ')}
                            </Text>
                          </View>
                        )}
                        {/* Bio */}
                        {member.bio && (
                          <Text style={[styles.memberItemBio, { color: colors.gray500 }]} numberOfLines={2}>
                            {member.bio}
                          </Text>
                        )}
                        {/* Joined date */}
                        {member.joined_at && (
                          <Text style={[styles.memberItemJoined, { color: colors.gray400 }]}>
                            {t('community.memberSince')} {formatRelativeTime(member.joined_at)}
                          </Text>
                        )}
                      </View>
	                    </View>
	                  ))}
	                </View>
              ) : (
                <View style={[styles.emptyMembersContainer, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                  <Users size={ICON.size.xl} color={colors.textDisabled} strokeWidth={ICON.strokeWidth} />
                  <Text style={[styles.emptyMembersText, { color: colors.textSecondary }]}>
                    {t('community.noMembers')}
                  </Text>
                  <Text style={[styles.emptyMembersSubtext, { color: colors.textDisabled }]}>
                    {t('community.noMembersSubtext')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
      )}

      {/* Activities Tab - Rendered outside ScrollView to avoid FlatList nesting issue */}
	      {(activeTab as string) === 'activities' && (
	        <View style={styles.activitiesContainer}>
          {/* Compact Header for Activities Tab */}
          <View style={styles.activitiesHeader}>
            <Text style={[styles.activitiesHeaderTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {community.name}
            </Text>
            {/* Tab Navigation */}
	            <TabBar
	              tabs={[
	                { key: 'presentation', label: t('community.presentation'), icon: PenSquare },
	                { key: 'activities', label: t('community.activities'), icon: BarChart2, count: community.activities_count || 0 },
	                { key: 'members', label: t('community.members'), icon: Users, count: community.members_count || 0 },
	              ]}
	              activeTab={activeTab}
	              onTabChange={(key) => setActiveTab(key as any)}
	            />
	          </View>
          <ActivityFeed
            communityId={id!}
            userRole={membershipStatus?.role}
            onActivityPress={(activity) => {
            }}
          />
        </View>
      )}

      {/* Action Footer */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        {(activeTab as string) !== 'activities' && (
          <View style={styles.ctaContainer}>
            {canManageCommunity ? (
              <Button
                title={t('community.manage')}
                onPress={() => router.push(`/settings/organization/community-members/${id}` as any)}
                fullWidth
                variant="outline"
                icon={<Settings size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
              />
            ) : currentSpace === 'organization' ? (
              // Organizations cannot join communities - no button shown
              null
            ) : membershipStatus?.is_member ? (
              // Members see "Voir l'actualité" button
              <Button
                title={t('community.viewActivity')}
                onPress={() => {
                  setActiveTab('activities');
                  scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                }}
                fullWidth
                variant="primary"
                icon={<Eye size={ICON.size.md} color={colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
              />
            ) : (
              // Non-members see "Rejoindre la communauté" or "Annuler ma demande" button
              <Button
                title={getButtonText()}
                onPress={handleJoin}
                fullWidth
                variant={getButtonVariant()}
                icon={<Users size={ICON.size.md} color={getButtonVariant() === 'primary' ? colors.textOnPrimary : colors.primary} strokeWidth={ICON.strokeWidth} />}
              />
            )}
          </View>
        )}
        <FooterNav activeTab="explore" />
      </View>

      {/* Floating Action Menu for Activities */}
      <FloatingActionMenu
        visible={activeTab === 'activities' && membershipStatus?.is_member}
        bottomOffset={80} // Above navigation/footer
        actions={[
          {
            icon: <BarChart2 size={24} color={colors.textOnPrimary} />,
            label: t('myCommunities.activityTypes.poll'),
            onPress: () => {
              router.push(`/details/community/${id}/create-poll`);
            },
            color: colors.warning,
          },
          {
            icon: <Calendar size={24} color={colors.textOnPrimary} />,
            label: t('myCommunities.activityTypes.event'),
            onPress: () => {
              router.push(`/details/community/${id}/create-event`);
            },
            color: colors.info,
          },
          {
            icon: <PenSquare size={24} color={colors.textOnPrimary} />,
            label: t('myCommunities.activityTypes.post'),
            onPress: () => {
              router.push(`/details/community/${id}/create-post`);
            },
            color: colors.primary,
          },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  activitiesContainer: {
    flex: 1,
  },
  activitiesHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  activitiesHeaderTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl,
  },
  sliderContainer: {
    marginBottom: SPACING.lg,
  },
  contentPadded: {
    paddingHorizontal: SPACING.lg,
  },
  // Organization Card
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  orgLogo: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
  },
  orgLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgLogoText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  orgInfo: {
    flex: 1,
  },
  orgNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  orgName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  orgTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  orgTag: {
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  orgTagText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },
  orgLocation: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  // Title
  title: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.sm,
  },
  // Tags Row
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  tagText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },
  // Meta Card
  metaCard: {
    padding: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  metaRowFull: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  metaItemFull: {
    flex: 1,
  },
  metaLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  metaValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginTop: 2,
  },
  // Categories
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  categoryTag: {
    paddingVertical: COMPONENT.pill.paddingVertical,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  categoryTagText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },
  // Sections
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },
  seeAllText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  sectionText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * 1.6,
  },
  // Members
  membersList: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 5,
  },
  memberAvatarContainer: {
    marginLeft: -8,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
  },
  memberAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  moreMembersCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  moreMembersText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: BORDER.width.thin,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {
    // Active state handled by indicator
  },
  tabText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  tabContentWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
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
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  // Tab Content
  tabContent: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  tabContentTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.sm,
  },
  tabContentText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * 1.6,
  },
  // Members Tab
  membersListContainer: {
    borderRadius: BORDER.radius.md,
    overflow: 'hidden',
    borderWidth: BORDER.width.thin,
  },
  // Member Item (for Members tab)
  memberItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
    gap: SPACING.md,
  },
  memberItemAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberItemAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberItemAvatarText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  memberItemInfo: {
    flex: 1,
    gap: 4,
  },
  memberItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  memberItemName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: COMPONENT.pill.gap,
    paddingHorizontal: COMPONENT.pill.paddingHorizontal,
    paddingVertical: COMPONENT.pill.paddingVertical,
    borderRadius: COMPONENT.pill.borderRadius,
  },
  adminBadgeText: {
    fontSize: COMPONENT.pill.fontSize,
    fontWeight: COMPONENT.pill.fontWeight,
  },
  memberItemLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberItemLocationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  memberItemBio: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },
  memberItemJoined: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  emptyMembersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },
  emptyMembersText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptyMembersSubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },
  footer: {
    // No paddingBottom - FooterNav handles safe area
  },
  ctaContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
});
