import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Platform, Modal } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
let WebView: any = null;
try { WebView = require('react-native-webview').WebView; } catch { /* unavailable */ }
import {
  ArrowLeft,
  MapPin,
  Clock,
  Calendar,
  Briefcase,
  Banknote,
  CheckCircle,
  Share,
  Bookmark,
  ChevronRight,
  Eye,
  Users,
  Link,
  Download,
  FileText,
  X,
  Settings,
} from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, BORDER, LAYOUT, OPACITY, withOpacity, COMPONENT } from '../../../src/constants/theme';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/contexts/I18nContext';
import { useSpace } from '../../../src/contexts/SpaceContext';
	import { Button, IconButton, ImageSlider, FooterNav, LoadingShimmer, SelectCard } from '../../../src/components/ui';
import { formatRelativeTime, formatDeadline, formatDate } from '../../../src/utils/date';
import { getFullImageUrl } from '../../../src/utils/image';
import { formatNumberNoTrailingZeros } from '../../../src/utils/number';
import { getFileType, getFullFileUrl } from '../../../src/utils/file';
import { RemoteImage } from '../../../src/components/ui/RemoteImage';
import type { Opportunity, OpportunityAttachment } from '../../../src/types/models';
import {
  getOpportunityTypeLabel,
  getContractTypeLabel,
  getWorkRhythmLabel,
  getLocationTypeLabel,
  getOrganizationTypeLabel,
  getCompensationFrequencyLabel,
} from '../../../src/types/models';
import { getCurrencySymbol } from '../../../src/constants/opportunity';
import { opportunityService, bookmarkService } from '../../../src/services';
import { applicationService } from '../../../src/services/applicationService';
import { BookmarkCheck } from 'lucide-react-native';
import { useAlert } from '../../../src/contexts/AlertContext';

// Mock data - in real app, fetch from API based on id

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const formatSalary = (min?: number, max?: number, currency?: string, frequency?: string, notSpecifiedLabel?: string): string => {
  if (!min && !max) return notSpecifiedLabel || 'Non spécifié';
  const currencyCode = currency || 'XOF';
  const currencySymbol = getCurrencySymbol(currencyCode);
  
  const freqLabelText = frequency ? getCompensationFrequencyLabel(frequency as any) : '';
  const freqLabel = freqLabelText ? ` ${freqLabelText}` : '';
  
  // Format numbers without decimals (.00)
  const formatNumber = (num: number): string => {
    const rounded = Math.round(num);
    return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  };
  
  if (min && max) {
    return `${formatNumber(min)} - ${formatNumber(max)} ${currencySymbol}${freqLabel}`;
  }
  return `${formatNumber(min || max || 0)} ${currencySymbol}${freqLabel}`;
};

const formatLocation = (opportunity: Opportunity, t?: (key: string) => string): string => {
  const location = opportunity.locations?.[0];
  
  if (opportunity.location_type === 'REMOTE') {
    return getLocationTypeLabel('REMOTE') || 'Remote';
  } else if (opportunity.location_type === 'HYBRID') {
    const hybridLabel = getLocationTypeLabel('HYBRID') || (t ? t('common.hybrid') : 'Hybride');
    if (location?.city && location?.country) {
      return `${hybridLabel} • ${location.city}, ${location.country}`;
    } else if (location?.city) {
      return `${hybridLabel} • ${location.city}`;
    }
    return hybridLabel;
  } else if (opportunity.location_type === 'ON_SITE') {
    if (location?.city && location?.country) {
      return `${location.city}, ${location.country}`;
    } else if (location?.city) {
      return location.city;
    }
    return getLocationTypeLabel('ON_SITE') || 'Sur site';
  } else {
    // Fallback: try to use location if available
    if (location?.city && location?.country) {
      return `${location.city}, ${location.country}`;
    } else if (location?.city) {
      return location.city;
    }
    return '-';
  }
};

export default function OpportunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentSpace } = useSpace();

  const [opportunity, setOpportunity] = useState<(Opportunity & { images?: string[]; organizations?: any[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<OpportunityAttachment | null>(null);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const alerts = useAlert();

  // Only show manage button if owner AND connected as organization
  const canManageOpportunity = isOwner && currentSpace === 'organization';

  useEffect(() => {
    loadOpportunity();
    checkApplication();
    checkBookmark();
  }, [id]);

  const checkBookmark = async () => {
    try {
      const response = await bookmarkService.isOpportunityBookmarked(id!);
      if (response.data) {
        setIsBookmarked(response.data.isBookmarked);
      }
    } catch (error) {
      // User might not be logged in, ignore
    }
  };

  const toggleBookmark = async () => {
    // Optimistic update
    setIsBookmarked(!isBookmarked);

    try {
      await bookmarkService.toggleOpportunity(id!, isBookmarked);
    } catch (error) {
      // Revert on error
      setIsBookmarked(isBookmarked);
      if (__DEV__) console.error('Error toggling bookmark:', error);
    }
  };

  const loadOpportunity = async () => {
    try {
      setIsLoading(true);
      const response = await opportunityService.getById(id!);
      if (response.data) {
        // Map organizations array to organization object for display
        const opp = response.data as any;
        if (opp.organizations && opp.organizations.length > 0) {
          opp.organization = opp.organizations[0];
        }
        setOpportunity(opp);
      }
    } catch (error: any) {
      if (__DEV__) console.error('Error loading opportunity:', error);
      void alerts.alert(t('common.error'), t('opportunity.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const checkApplication = async () => {
    try {
      const response = await applicationService.hasApplied(id!);
      if (response.data) {
        setHasApplied(response.data.applied || false);
        setApplicationId(response.data.application_id || response.data.application?.id || null);
        setIsOwner(response.data.is_owner || false);
      }
    } catch (error) {
      // User might not be logged in, ignore error
    }
  };

  const handleApply = () => {
    if (hasApplied && applicationId) {
      // Navigate to application detail
      router.push(`/settings/my-applications/${applicationId}`);
    } else {
      // Navigate to apply screen
      router.push(`/details/opportunity/apply/${id}`);
    }
  };

  const handleDownloadAttachment = async (attachment: OpportunityAttachment) => {
    try {
      const fullUrl = getFullFileUrl(attachment.url);
      const canOpen = await Linking.canOpenURL(fullUrl);
      if (canOpen) {
        await Linking.openURL(fullUrl);
      } else {
        void alerts.alert(t('common.error'), t('opportunity.openError'));
      }
    } catch (error) {
      if (__DEV__) console.error('Error opening attachment:', error);
      void alerts.alert(t('common.error'), t('opportunity.openError'));
    }
  };

  const handleOpenAttachmentModal = (attachment: OpportunityAttachment) => {
    setSelectedAttachment(attachment);
    setShowAttachmentModal(true);
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${formatNumberNoTrailingZeros(bytes / 1024, 1)} KB`;
    return `${formatNumberNoTrailingZeros(bytes / (1024 * 1024), 1)} MB`;
  };

  const isLocalFile = (url: string): boolean => {
    return url.startsWith('file://') || url.startsWith('content://') || !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/');
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

  if (!opportunity) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textPrimary }}>{t('opportunity.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const deadline = opportunity.deadline ? formatDeadline(opportunity.deadline) : null;
  const postedAt = opportunity.posted_at ? formatRelativeTime(opportunity.posted_at) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
	      {/* Header with floating CTA */}
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Slider */}
        <View style={styles.sliderContainer}>
          <ImageSlider
            images={(opportunity.images?.length ? opportunity.images : (opportunity.cover_image_url ? [opportunity.cover_image_url] : [])).map(img => getFullImageUrl(img) || '')}
            height={220}
          />
        </View>

        <View style={styles.contentPadded}>
          {/* Organization Card */}
          {opportunity.organization?.id && (
            <SelectCard
              style={[styles.orgCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
              onPress={() => router.push(`/details/organization/${opportunity.organization!.id}`)}
              selected={false}
              accessibilityLabel={t('common.viewOrganization', { name: opportunity.organization.name })}
            >
              {opportunity.organization.logo_url ? (
                <RemoteImage uri={opportunity.organization.logo_url} style={styles.orgLogo} />
              ) : (
                <View style={[styles.orgLogoPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.orgLogoText, { color: colors.textOnPrimary }]}>
                    {getInitials(opportunity.organization.name || '')}
                  </Text>
                </View>
              )}
              <View style={styles.orgInfo}>
                <View style={styles.orgNameRow}>
                  <Text style={[styles.orgName, { color: colors.textPrimary }]}>
                    {opportunity.organization.name}
                  </Text>
                  {opportunity.organization.verification_status === 'VERIFIED' && (
                    <CheckCircle size={ICON.size.sm} color={colors.success} fill={colors.success} strokeWidth={0} />
                  )}
                </View>
                <View style={styles.orgTagsRow}>
                  {opportunity.organization.type && (
                    <View style={[styles.orgTag, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                      <Text style={[styles.orgTagText, { color: colors.primary }]}>
                        {getOrganizationTypeLabel(opportunity.organization.type) || opportunity.organization.type}
                      </Text>
                    </View>
                  )}
                  {opportunity.organization.headquarters_city && (
                    <Text style={[styles.orgLocation, { color: colors.textSecondary }]}>
                      {opportunity.organization.headquarters_city}{opportunity.organization.headquarters_country ? `, ${opportunity.organization.headquarters_country}` : ''}
                    </Text>
                  )}
                </View>
              </View>
              <ChevronRight size={ICON.size.sm} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
            </SelectCard>
          )}

          {/* Title */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {opportunity.title}
          </Text>

          {/* Slug - Click to copy */}
          {opportunity.slug && (
            <SelectCard
              style={[styles.slugContainer, { borderWidth: 0, backgroundColor: 'transparent', borderColor: 'transparent' }]}
              onPress={async () => {
                const url = `https://etudesk.com/public/opportunities/${opportunity.slug}`;
                await Clipboard.setStringAsync(url);
                void alerts.alert(t('common.copied'), t('opportunity.linkCopied'));
              }}
              selected={false}
              accessibilityLabel={t('common.copyLink')}
            >
              <Link size={ICON.size.sm} color={colors.gray400} strokeWidth={ICON.strokeWidth} />
              <Text style={[styles.slugText, { color: colors.gray400 }]}>
                {opportunity.slug}
              </Text>
            </SelectCard>
          )}

          {/* Tags */}
          <View style={styles.tagsRow}>
            {opportunity.type && (
              <View style={[styles.tag, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>
                  {getOpportunityTypeLabel(opportunity.type) || opportunity.type}
                </Text>
              </View>
            )}
            {opportunity.contract_type && (
              <View style={[styles.tag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                  {getContractTypeLabel(opportunity.contract_type) || opportunity.contract_type}
                </Text>
              </View>
            )}
            {opportunity.work_rhythm && (
              <View style={[styles.tag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                  {getWorkRhythmLabel(opportunity.work_rhythm) || opportunity.work_rhythm}
                </Text>
              </View>
            )}
            {opportunity.location_type && (
              <View style={[styles.tag, { backgroundColor: colors.gray100 }]}>
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                  {getLocationTypeLabel(opportunity.location_type) || opportunity.location_type}
                </Text>
              </View>
            )}
          </View>

          {/* Meta Info */}
          <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
            {/* Views + Applications */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Users size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('opportunity.applications')}</Text>
                  <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                    {formatNumberNoTrailingZeros(opportunity.applications_count || 0, 0)}
                  </Text>
                </View>
              </View>
            </View>
            {/* Deadline + Start date */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Calendar size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('opportunity.deadline')}</Text>
                  <Text style={[styles.metaValue, deadline?.isUrgent && styles.urgentText, { color: deadline?.isUrgent ? colors.error : colors.textPrimary }]}>
                    {opportunity.deadline ? formatDate(opportunity.deadline) : '-'}
                  </Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <Briefcase size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('opportunity.startDate')}</Text>
                  <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                    {opportunity.start_date ? formatDate(opportunity.start_date) : '-'}
                  </Text>
                </View>
              </View>
            </View>
            {/* Location + Posted at */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <MapPin size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('opportunity.location')}</Text>
                  <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                    {formatLocation(opportunity, t)}
                  </Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <Clock size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                <View>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('opportunity.postedAt')}</Text>
                  <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                    {postedAt || '-'}
                  </Text>
                </View>
              </View>
            </View>
            {/* Rémunération - single line */}
            <View style={styles.metaRowFull}>
              <Banknote size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
              <View style={styles.metaItemFull}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{t('opportunity.salary')}</Text>
                <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                  {formatSalary(
                    opportunity.compensation_min,
                    opportunity.compensation_max,
                    opportunity.currency,
                    opportunity.compensation_frequency,
                    t('common.notSpecified')
                  )}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          {opportunity.summary && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('opportunity.description')}</Text>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                {opportunity.summary}
              </Text>
            </View>
          )}

          {/* Requirements */}
          {opportunity.requirements && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('opportunity.requirements')}</Text>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                {opportunity.requirements}
              </Text>
            </View>
          )}

          {/* Nice to have */}
          {opportunity.nice_to_have && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('opportunity.niceToHave')}</Text>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                {opportunity.nice_to_have}
              </Text>
            </View>
          )}

          {/* Attachments */}
          {(() => {
            // Filter out local files (not yet uploaded)
            const uploadedAttachments = opportunity.attachments?.filter(att => !isLocalFile(att.url)) || [];
            
            if (uploadedAttachments.length === 0) {
              return null;
            }

            return (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('opportunity.attachments')}</Text>
                {uploadedAttachments.map((attachment, index) => {
                  const fileType = getFileType(attachment.url, attachment.type);
                  const fullUrl = getFullFileUrl(attachment.url);

                return (
                  <View key={index} style={[styles.attachmentCard, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                    {/* File header with name and download */}
                    <View style={styles.attachmentHeader}>
                      <View style={styles.attachmentHeaderLeft}>
                        <View style={styles.attachmentInfo}>
                          <Text style={[styles.attachmentName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {attachment.name}
                          </Text>
                          {attachment.size && (
                            <Text style={[styles.attachmentSize, { color: colors.textSecondary }]}>
                              {formatFileSize(attachment.size)}
                            </Text>
                          )}
                        </View>
                      </View>
	                      <IconButton
	                        onPress={() => handleDownloadAttachment(attachment)}
	                        icon={<Download size={18} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
	                        accessibilityLabel={t('common.download')}
	                        variant="outline"
	                        size="sm"
	                        style={[styles.attachmentDownloadButton, { borderColor: colors.primary }]}
	                      />
                    </View>

                    {/* Content based on file type */}
                    {fileType === 'image' && (
                      <View style={styles.attachmentImageContainer}>
                        <Image
                          source={{ uri: fullUrl }}
                          style={styles.attachmentImage}
                          resizeMode="contain"
                        />
                      </View>
                    )}

                    {fileType === 'pdf' && (
                      <View style={styles.attachmentPreviewContainer}>
                        <WebView
                          source={{ uri: fullUrl }}
                          style={styles.attachmentWebView}
                          originWhitelist={['*']}
                          allowFileAccess={true}
                          allowFileAccessFromFileURLs={true}
                          allowUniversalAccessFromFileURLs={true}
                          startInLoadingState={true}
                          renderLoading={() => (
                            <View style={styles.attachmentLoading}>
                              <LoadingShimmer variant="inline" label={t('opportunity.loadingPdf')} />
                            </View>
                          )}
                        />
                      </View>
                    )}

                    {fileType === 'video' && (
                      <View style={styles.attachmentPreviewContainer}>
                        <WebView
                          source={{
                            html: `
                              <!DOCTYPE html>
                              <html>
                                <head>
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <style>
                                    body {
                                      margin: 0;
                                      padding: 0;
                                      background: ${colors.background};
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                      height: 100vh;
                                    }
                                    video {
                                      width: 100%;
                                      height: 100%;
                                      object-fit: contain;
                                    }
                                  </style>
                                </head>
                                <body>
                                  <video controls autoplay>
                                    <source src="${fullUrl}" type="video/mp4">
                                    ${t('opportunity.videoNotSupported')}
                                  </video>
                                </body>
                              </html>
                            `,
                          }}
                          style={styles.attachmentWebView}
                          allowsFullscreenVideo={true}
                          startInLoadingState={true}
                          renderLoading={() => (
                            <View style={styles.attachmentLoading}>
                              <LoadingShimmer variant="inline" label={t('opportunity.loadingVideo')} />
                            </View>
                          )}
                        />
                      </View>
                    )}

                    {fileType === 'other' && (
                      <View style={styles.attachmentOtherContainer}>
                        <Text style={[styles.attachmentOtherText, { color: colors.textSecondary }]}>
                          {t('opportunity.unsupportedFile')}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
              </View>
            );
          })()}

          {/* About Organization */}
          {opportunity.organization?.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('opportunity.aboutOrg', { name: opportunity.organization.name })}
              </Text>
              <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
                {opportunity.organization.description}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer with CTA and Navigation */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <View style={styles.ctaContainer}>
          {canManageOpportunity ? (
            <Button
              title={t('opportunity.manage')}
              onPress={() => router.push(`/gestion/opportunities/applications/${id}` as any)}
              fullWidth
              variant="outline"
              icon={<Settings size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
            />
          ) : (
            <Button
              title={hasApplied ? t('opportunity.viewApplication') : t('opportunity.apply')}
              onPress={handleApply}
              fullWidth
              variant={hasApplied ? 'outline' : 'primary'}
              icon={<Briefcase size={ICON.size.md} color={hasApplied ? colors.primary : colors.textOnPrimary} strokeWidth={ICON.strokeWidth} />}
            />
          )}
        </View>
        <FooterNav activeTab="explore" />
      </View>

      {/* Attachment Modal for PDFs and Videos */}
      {selectedAttachment && (
        <Modal
          visible={showAttachmentModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowAttachmentModal(false)}
        >
          <SafeAreaView style={[styles.attachmentModalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.attachmentModalHeader, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.attachmentModalTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {selectedAttachment.name}
              </Text>
	              <View style={styles.attachmentModalHeaderActions}>
	                <IconButton
	                  onPress={() => handleDownloadAttachment(selectedAttachment)}
	                  icon={<Download size={20} color={colors.primary} strokeWidth={ICON.strokeWidth} />}
	                  accessibilityLabel={t('common.download')}
	                  variant="filled"
	                  style={[styles.attachmentModalDownloadButton, { backgroundColor: colors.gray100 }]}
	                />
	                <IconButton
	                  onPress={() => setShowAttachmentModal(false)}
	                  icon={<X size={24} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
	                  accessibilityLabel={t('common.close')}
	                  style={styles.attachmentModalCloseButton}
	                />
	              </View>
            </View>
            {(() => {
              const fileType = getFileType(selectedAttachment.url, selectedAttachment.type);
              const fullUrl = getFullFileUrl(selectedAttachment.url);

              if (fileType === 'pdf') {
                return (
                  <WebView
                    source={{ uri: fullUrl }}
                    style={styles.attachmentModalWebView}
                    originWhitelist={['*']}
                    allowFileAccess={true}
                    allowFileAccessFromFileURLs={true}
                    allowUniversalAccessFromFileURLs={true}
                    startInLoadingState={true}
                    renderLoading={() => (
                      <View style={styles.attachmentModalLoading}>
                        <LoadingShimmer variant="inline" label={t('opportunity.loadingPdf')} />
                      </View>
                    )}
                  />
                );
              }

              if (fileType === 'video') {
                return (
                  <WebView
                    source={{
                      html: `
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                              body {
                                margin: 0;
                                padding: 0;
                                background: ${colors.background};
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                height: 100vh;
                              }
                              video {
                                width: 100%;
                                height: 100%;
                                object-fit: contain;
                              }
                            </style>
                          </head>
                          <body>
                            <video controls autoplay>
                              <source src="${fullUrl}" type="video/mp4">
                              ${t('opportunity.videoNotSupported')}
                            </video>
                          </body>
                        </html>
                      `,
                    }}
                    style={styles.attachmentModalWebView}
                    allowsFullscreenVideo={true}
                    startInLoadingState={true}
                    renderLoading={() => (
                      <View style={styles.attachmentModalLoading}>
                        <LoadingShimmer variant="inline" label={t('opportunity.loadingVideo')} />
                      </View>
                    )}
                  />
                );
              }

              return null;
            })()}
          </SafeAreaView>
        </Modal>
      )}
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

  orgType: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
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

  title: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.sm,
  },

  slugContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },

  slugText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

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

  urgentText: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

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

  footer: {
    // No paddingBottom - FooterNav handles safe area
  },

  ctaContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  // Attachment styles
  attachmentCard: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },

  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },

  attachmentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },

  attachmentInfo: {
    flex: 1,
  },

  attachmentName: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  attachmentSize: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },

  attachmentDownloadButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
    borderWidth: BORDER.width.thin,
  },

  attachmentImageContainer: {
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
    marginTop: SPACING.sm,
  },

  attachmentImage: {
    width: '100%',
    height: 300,
    // backgroundColor set dynamically via inline styles
  },

  attachmentPreviewContainer: {
    borderRadius: BORDER.radius.sm,
    overflow: 'hidden',
    borderWidth: BORDER.width.thin,
    // borderColor set dynamically via inline styles
    marginTop: SPACING.sm,
  },

  attachmentWebView: {
    height: 400,
    // backgroundColor set dynamically via inline styles
  },

  attachmentLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor set dynamically via inline styles
  },

  attachmentLoadingText: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  attachmentFullscreenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: BORDER.radius.sm,
    borderWidth: BORDER.width.thin,
    marginTop: SPACING.sm,
  },

  attachmentFullscreenButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  attachmentOtherContainer: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    // backgroundColor set dynamically via inline styles
    marginTop: SPACING.sm,
  },

  attachmentOtherText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },

  // Attachment Modal styles
  attachmentModalContainer: {
    flex: 1,
  },

  attachmentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },

  attachmentModalTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginRight: SPACING.md,
  },

  attachmentModalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  attachmentModalDownloadButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER.radius.sm,
  },

  attachmentModalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  attachmentModalWebView: {
    flex: 1,
  },

  attachmentModalLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor set dynamically via inline styles
  },

  attachmentModalLoadingText: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
