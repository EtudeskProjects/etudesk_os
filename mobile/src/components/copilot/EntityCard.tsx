/**
 * EntityCard — Smart entity cards that auto-fetch data from API
 * Receives {"id":"uuid"} from copilot, fetches full entity data, renders rich card
 * Routes to detail pages on press
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Briefcase,
  Users,
  Building2,
  MapPin,
  ChevronRight,
  User,
  FileText,
  CalendarDays,
  Bell,
  Sparkles,
  Compass,
  Clock3,
  EyeOff,
  Eye,
  Share2,
  Video,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../constants/theme';
import { fetchEntityBatched } from '../../services/entityBatchFetcher';
import { API_CONFIG } from '../../constants/config';
import { formatNumberNoTrailingZeros } from '../../utils/number';
import { ShimmerPlaceholder } from '../ui';
import { downloadAndOpenDocument, downloadAndShareDocument } from '../../utils/documentDownload';
import { getCurrentLocale } from '../../i18n';
import { getLabel } from '../../utils/labels';
import { getNotificationRoute } from '../../hooks/notifications/notificationNavigation';


interface EntityCardProps {
  type: string;
  data: Record<string, any>;
}

interface MetaItem {
  icon?: any;
  text: string;
  color?: string;
}

function toNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function sanitizeText(value: unknown, max = 80): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function normalizeTextKey(value: unknown): string {
  return sanitizeText(value, 200)?.toLowerCase() || '';
}

function formatDateTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString(getCurrentLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return undefined;
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours} h`;
  if (days < 7) return `${days} j`;
  return date.toLocaleDateString(getCurrentLocale(), { day: 'numeric', month: 'short' });
}

function getMapCoordinates(raw: Record<string, any>): { lat: number; lng: number } | null {
  const lat = toNumber(raw.latitude ?? raw.lat ?? raw.coordinates?.latitude ?? raw.coordinates?.lat);
  const lng = toNumber(raw.longitude ?? raw.lng ?? raw.coordinates?.longitude ?? raw.coordinates?.lng);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

function pushUniqueMetaItem(params: {
  items: MetaItem[];
  seen: Set<string>;
  blocked: Set<string>;
  item?: MetaItem | null;
  maxItems?: number;
}) {
  const { items, seen, blocked, item, maxItems = 3 } = params;
  if (!item || items.length >= maxItems) return;
  const text = sanitizeText(item.text, 48);
  if (!text) return;
  const key = normalizeTextKey(text);
  if (!key || seen.has(key) || blocked.has(key)) return;
  seen.add(key);
  items.push({ ...item, text });
}

/** Normalize API response to display-friendly fields */
function normalizeEntity(type: string, raw: Record<string, any>): Record<string, any> {
  switch (type) {
    case 'opportunity':
      return {
        ...raw,
        title: raw.title,
        imageUrl: raw.cover_image_url || raw.images?.[0],
        subtitle: raw.organization?.name || raw.organizations?.[0]?.name,
        location: raw.locations?.[0]?.city || raw.city,
        metaType: raw.type,
      };
    case 'community':
      return {
        ...raw,
        title: raw.name,
        imageUrl: raw.cover_image_url || raw.images?.[0],
        subtitle: raw.organization?.name || raw.description?.slice(0, 80),
        location: raw.city,
        memberCount: raw.members_count,
        metaType: raw.type,
      };
    case 'space':
      return {
        ...raw,
        title: raw.name,
        imageUrl: raw.cover_image_url || raw.gallery_images?.[0],
        subtitle: raw.organization?.name,
        location: raw.city,
        capacity: raw.capacity,
        hourlyRate: raw.hourly_rate ? `${formatNumberNoTrailingZeros(raw.hourly_rate, 0)} FCFA/h` : undefined,
        metaType: raw.type,
      };
    case 'organization':
      return {
        ...raw,
        title: raw.name,
        imageUrl: raw.logo_url,
        subtitle: raw.description?.slice(0, 80),
        location: raw.headquarters_city,
        metaType: raw.type,
      };
    case 'talent':
      return {
        ...raw,
        title: raw.display_name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim(),
        imageUrl: raw.avatar_url,
        subtitle: raw.bio?.slice(0, 80),
        location: raw.city,
        topSkills: Array.isArray(raw.skills)
          ? raw.skills.map((s: any) => (typeof s === 'string' ? s : s.name)).slice(0, 3)
          : undefined,
      };
    case 'document':
      return {
        ...raw,
        title: raw.title || raw.original_filename,
        subtitle: raw.document_type || raw.category,
        file_url: raw.file_url || raw.downloadUrl,
      };
    case 'event':
      return {
        ...raw,
        title: raw.title || raw.metadata?.title || raw.name || raw.content,
        imageUrl: raw.imageUrl || raw.attachments?.[0],
        subtitle: raw.subtitle || raw.community_name || raw.community?.name,
        location: raw.location || raw.metadata?.location,
        startDate: raw.startDate || raw.start_date || raw.metadata?.start_date,
        endDate: raw.endDate || raw.end_date || raw.metadata?.end_date,
        locationType: raw.locationType || raw.location_type || raw.metadata?.location_type,
        meetingUrl: raw.meetingUrl || raw.meeting_url || raw.metadata?.meeting_url,
      };
    case 'skill':
      return {
        ...raw,
        title: raw.title || raw.canonical_name || raw.name,
        subtitle: raw.subtitle || sanitizeText(raw.context),
        proficiencyLevel: raw.proficiencyLevel || raw.proficiency_level,
        skillType: raw.skillType || raw.type,
      };
    case 'notification':
      return {
        ...raw,
        title: raw.title,
        subtitle: raw.subtitle || raw.body,
        notificationType: raw.notificationType || raw.type,
      };
    case 'maps':
      return {
        ...raw,
        title: raw.title || raw.label || raw.name || raw.address,
        subtitle: raw.subtitle || raw.address || raw.description || [raw.city, raw.country].filter(Boolean).join(', '),
        coordinates: getMapCoordinates(raw),
        mapUrl: raw.mapUrl || raw.url,
      };
    default:
      return raw;
  }
}

/** Check if data needs fetching (only has id, no display fields) */
function needsFetch(data: Record<string, any>): boolean {
  return !!(
    data.id &&
    !data.title &&
    !data.name &&
    !data.first_name &&
    !data.original_filename &&
    !data.display_name
  );
}

/** Resolve image URL from entity data */
function getImageUrl(type: string, data: Record<string, any>): string | undefined {
  if (data.imageUrl) return data.imageUrl;
  switch (type) {
    case 'opportunity':
      return data.cover_image_url || data.coverImageUrl || data.images?.[0];
    case 'community':
      return data.cover_image_url || data.coverImageUrl || data.images?.[0];
    case 'space':
      return data.cover_image_url || data.coverImageUrl || data.gallery_images?.[0] || data.galleryImages?.[0];
    case 'organization':
      return data.logo_url || data.logoUrl;
    case 'talent':
      return data.avatar_url || data.avatarUrl;
    case 'event':
      return data.attachments?.[0];
    default:
      return undefined;
  }
}

export const EntityCard: React.FC<EntityCardProps> = React.memo(({ type, data: initialData }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const [entityData, setEntityData] = useState<Record<string, any>>(initialData);
  const [loading, setLoading] = useState(false);
  const [documentAction, setDocumentAction] = useState<'view' | 'share' | null>(null);
  const [error, setError] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Auto-fetch entity data via batched API call (debounced 100ms)
  // Documents always need fetch to get file_url for clickable download
  useEffect(() => {
    const needsDocumentUrl = type === 'document' && !initialData.file_url && !initialData.downloadUrl;
    if (!needsFetch(initialData) && !needsDocumentUrl) return;
    if (!initialData.id) return;

    let cancelled = false;
    setLoading(true);

    fetchEntityBatched(type, initialData.id)
      .then((entity) => {
        if (cancelled) return;
        if (entity) {
          setEntityData({ ...initialData, ...entity });
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [initialData.id, type]);

  const data = normalizeEntity(type, entityData);
  const isDocument = type === 'document';
  const documentFileUrl = data.file_url || data.downloadUrl;
  const documentName = data.filename || data.original_filename || data.title || 'document';
  const documentMimeType = data.mime_type || 'application/pdf';

  const runDocumentAction = async (action: 'view' | 'share') => {
    if (documentAction) return;

    if (!documentFileUrl) {
      const id = data.id;
      if (id && action === 'view') {
        router.push(`/details/document/${id}` as any);
      }
      return;
    }

    try {
      setDocumentAction(action);
      if (action === 'view') {
        await downloadAndOpenDocument({
          url: documentFileUrl,
          filename: documentName,
          mimeType: documentMimeType,
        });
      } else {
        await downloadAndShareDocument({
          url: documentFileUrl,
          filename: documentName,
          mimeType: documentMimeType,
        });
      }
    } catch (err: any) {
      const absoluteUrl = documentFileUrl.startsWith('http') ? documentFileUrl : `${API_CONFIG.BASE_URL}${documentFileUrl}`;
      if (__DEV__) console.error(`[EntityCard] document ${action} error:`, err, 'url:', absoluteUrl);
      Alert.alert(
        t('common.error'),
        __DEV__
          ? `${action === 'share' ? t('errors.shareDocument') : t('common.downloadFailed')}${err?.message || err}\nURL: ${absoluteUrl}`
          : action === 'share'
            ? t('errors.shareDocument')
            : t('common.downloadError')
      );
    } finally {
      setDocumentAction(null);
    }
  };

  const handlePress = () => {
    if (type === 'maps') {
      const coords = getMapCoordinates(data);
      const mapUrl =
        data.mapUrl ||
        data.url ||
        (coords
          ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
          : data.address || data.location || data.title
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([data.address || data.location || data.title, data.city, data.country].filter(Boolean).join(', '))}`
            : null);
      if (mapUrl) {
        void Linking.openURL(mapUrl);
      }
      return;
    }

    if (type === 'skill') {
      router.push('/settings/skills' as any);
      return;
    }

    if (type === 'notification') {
      const route = getNotificationRoute({
        type: data.notificationType || data.type,
        ...(typeof data.data === 'object' && data.data ? data.data : {}),
      });
      if (route) {
        router.push(route as any);
      } else {
        router.push('/settings/notifications' as any);
      }
      return;
    }

    const id = data.id;
    if (!id || id === 'null' || id === 'undefined') return;

    switch (type) {
      case 'opportunity':
        router.push(`/details/opportunity/${id}`);
        break;
      case 'community':
        router.push(`/details/community/${id}`);
        break;
      case 'space':
        router.push(`/details/space/${id}`);
        break;
      case 'organization':
        router.push(`/details/organization/${id}`);
        break;
      case 'talent':
        router.push(`/details/talent/${id}`);
        break;
      case 'event':
        router.push(`/details/community/activity/${id}` as any);
        break;
      case 'document':
        if (documentFileUrl) {
          void runDocumentAction('view');
        } else {
          router.push(`/details/document/${id}` as any);
        }
        break;
    }
  };

  const imageUrl = getImageUrl(type, data);

  // Reset image error when URL changes
  useEffect(() => { setImgError(false); }, [imageUrl]);

  // Type badge config
  const typeConfig = {
    opportunity: { icon: Briefcase, color: colors.primary, label: t('copilot.entity.opportunity') },
    community: { icon: Users, color: colors.info, label: t('copilot.entity.community') },
    space: { icon: Building2, color: colors.warning, label: t('copilot.entity.space') },
    organization: { icon: Building2, color: colors.success, label: t('copilot.entity.organization') },
    talent: { icon: User, color: colors.primary, label: t('copilot.entity.talent') },
    document: { icon: FileText, color: colors.success, label: t('copilot.entity.document') },
    event: { icon: CalendarDays, color: colors.info, label: t('copilot.entity.event') },
    skill: { icon: Sparkles, color: colors.warning, label: t('copilot.entity.skill') },
    notification: { icon: Bell, color: colors.primary, label: t('copilot.entity.notification') },
    maps: { icon: Compass, color: colors.success, label: t('copilot.entity.maps') },
  }[type] || { icon: Briefcase, color: colors.textSecondary, label: type };

  const TypeIcon = typeConfig.icon;
  const rawTitle =
    data.title ||
    data.label ||
    data.name ||
    data.canonical_name ||
    data.original_filename ||
    data.filename ||
    '';
  const rawSubtitle =
    data.subtitle ||
    data.body ||
    data.organization?.name ||
    data.organizations?.[0]?.name ||
    data.headline ||
    sanitizeText(data.description) ||
    undefined;
  const title = sanitizeText(rawTitle, 72);
  const subtitle = sanitizeText(rawSubtitle, 88);
  const blockedMeta = new Set([normalizeTextKey(title), normalizeTextKey(subtitle)].filter(Boolean));

  // Build meta items
  const metaItems: MetaItem[] = [];
  const seenMeta = new Set<string>();
  if (data.location || data.city) {
    pushUniqueMetaItem({
      items: metaItems,
      seen: seenMeta,
      blocked: blockedMeta,
      item: { icon: MapPin, text: data.location || data.city },
    });
  }
  if (data.metaType || data.type) {
    pushUniqueMetaItem({
      items: metaItems,
      seen: seenMeta,
      blocked: blockedMeta,
      item: { text: data.metaType || data.type },
    });
  }
  if (data.memberCount !== undefined || data.members_count !== undefined) {
    const count = data.memberCount ?? data.members_count;
    pushUniqueMetaItem({
      items: metaItems,
      seen: seenMeta,
      blocked: blockedMeta,
      item: { icon: Users, text: t('copilot.entity.memberCount', { count }) },
    });
  }
  if (data.capacity) {
    pushUniqueMetaItem({
      items: metaItems,
      seen: seenMeta,
      blocked: blockedMeta,
      item: { text: t('copilot.entity.capacityCount', { count: formatNumberNoTrailingZeros(data.capacity, 0) }) },
    });
  }
  if (data.hourlyRate || data.hourly_rate) {
    const rate = data.hourlyRate || `${formatNumberNoTrailingZeros(data.hourly_rate, 0)} FCFA/h`;
    pushUniqueMetaItem({
      items: metaItems,
      seen: seenMeta,
      blocked: blockedMeta,
      item: { text: rate, color: colors.primary },
    });
  }
  if (data.topSkills?.length) {
    pushUniqueMetaItem({
      items: metaItems,
      seen: seenMeta,
      blocked: blockedMeta,
      item: { text: data.topSkills.slice(0, 3).join(', ') },
    });
  }
  if (type === 'event') {
    const eventDate = formatDateTime(data.startDate || data.start_date);
    if (eventDate) {
      pushUniqueMetaItem({
        items: metaItems,
        seen: seenMeta,
        blocked: blockedMeta,
        item: { icon: CalendarDays, text: eventDate },
      });
    }
    if ((data.locationType || data.location_type) === 'ONLINE') {
      pushUniqueMetaItem({
        items: metaItems,
        seen: seenMeta,
        blocked: blockedMeta,
        item: {
          icon: data.meetingUrl || data.meeting_url ? Video : CalendarDays,
          text: t('copilot.entity.onlineEvent'),
        },
      });
    } else if ((data.locationType || data.location_type) === 'PHYSICAL') {
      pushUniqueMetaItem({
        items: metaItems,
        seen: seenMeta,
        blocked: blockedMeta,
        item: { icon: MapPin, text: t('copilot.entity.physicalEvent') },
      });
    }
  }
  if (type === 'skill') {
    const proficiency = data.proficiencyLevel || data.proficiency_level;
    const skillType = data.skillType || data.type;
    if (proficiency) {
      pushUniqueMetaItem({
        items: metaItems,
        seen: seenMeta,
        blocked: blockedMeta,
        item: { text: getLabel('proficiencyLevels', proficiency) },
      });
    }
    if (skillType) {
      pushUniqueMetaItem({
        items: metaItems,
        seen: seenMeta,
        blocked: blockedMeta,
        item: { text: getLabel('skillTypes', skillType) },
      });
    }
    if (data.is_visible === false) {
      pushUniqueMetaItem({
        items: metaItems,
        seen: seenMeta,
        blocked: blockedMeta,
        item: { icon: EyeOff, text: t('copilot.entity.privateSkill') },
      });
    }
  }
  if (type === 'notification') {
    const relativeTime = formatRelativeTime(data.created_at);
    if (relativeTime) {
      pushUniqueMetaItem({
        items: metaItems,
        seen: seenMeta,
        blocked: blockedMeta,
        item: { icon: Clock3, text: relativeTime },
      });
    }
    pushUniqueMetaItem({
      items: metaItems,
      seen: seenMeta,
      blocked: blockedMeta,
      item: {
        text: data.read_at ? t('copilot.entity.read') : t('copilot.entity.unread'),
        color: data.read_at ? colors.textSecondary : colors.primary,
      },
    });
  }
  if (type === 'maps') {
    const coords = getMapCoordinates(data);
    if (coords) {
      pushUniqueMetaItem({
        items: metaItems,
        seen: seenMeta,
        blocked: blockedMeta,
        item: { text: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` },
      });
    }
  }

  const isRound = type === 'talent' || type === 'organization';

  // Loading skeleton
  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        <View
          style={[
            styles.imageContainer,
            isRound ? styles.imageRound : styles.imageSquare,
            { backgroundColor: withOpacity(typeConfig.color, OPACITY[10]) },
          ]}
        >
          <TypeIcon size={20} color={typeConfig.color} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.cardType, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          <View style={[styles.skeletonLine, { backgroundColor: withOpacity(colors.textSecondary, OPACITY[15]) }]} />
          <View style={[styles.skeletonLineShort, { backgroundColor: withOpacity(colors.textSecondary, OPACITY[10]) }]} />
        </View>
        {isDocument ? (
          <View style={styles.documentActions}>
            <ShimmerPlaceholder width={28} height={28} variant="block" />
            <ShimmerPlaceholder width={28} height={28} variant="block" />
          </View>
        ) : (
          <ShimmerPlaceholder width={24} height={14} variant="bar" />
        )}
      </View>
    );
  }

  // Error state — still tappable to navigate to detail
  if (error && !title) {
    if (isDocument) {
      return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
          <View
            style={[
              styles.imageContainer,
              isRound ? styles.imageRound : styles.imageSquare,
              { backgroundColor: withOpacity(typeConfig.color, OPACITY[10]) },
            ]}
          >
            <TypeIcon size={20} color={typeConfig.color} />
          </View>
          <View style={styles.content}>
            <Text style={[styles.cardType, { color: typeConfig.color }]}>{typeConfig.label}</Text>
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('copilot.entity.viewDetails')}
            </Text>
          </View>
          <View style={styles.documentActions}>
            <Pressable
              style={[styles.documentActionButton, { borderColor: colors.borderColor, opacity: 0.5 }]}
              disabled
            >
              <Eye size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.documentActionButton, { borderColor: colors.borderColor, opacity: 0.5 }]}
              disabled
            >
              <Share2 size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={t('copilot.entity.viewDetails')}
      >
        <View
          style={[
            styles.imageContainer,
            isRound ? styles.imageRound : styles.imageSquare,
            { backgroundColor: withOpacity(typeConfig.color, OPACITY[10]) },
          ]}
        >
          <TypeIcon size={20} color={typeConfig.color} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.cardType, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('copilot.entity.viewDetails')}
          </Text>
        </View>
        <ChevronRight size={16} color={colors.textSecondary} style={styles.chevron} />
      </Pressable>
    );
  }

  const body = (
    <>
      <View
        style={[
          styles.imageContainer,
          isRound ? styles.imageRound : styles.imageSquare,
          { backgroundColor: withOpacity(typeConfig.color, OPACITY[10]) },
        ]}
      >
        {imageUrl && !imgError ? (
          <Image
            key={imageUrl}
            source={{ uri: imageUrl }}
            style={isRound ? styles.imageRound : styles.imageSquare}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <TypeIcon size={20} color={typeConfig.color} />
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardType, { color: typeConfig.color }]}>{typeConfig.label}</Text>
        </View>

        {title ? (
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}

        {subtitle ? (
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}

        {metaItems.length > 0 && (
          <View style={styles.cardMeta}>
            {metaItems.map((item, idx) => {
              const MetaIcon = item.icon;
              return (
                <View key={idx} style={styles.metaItem}>
                  {MetaIcon && <MetaIcon size={11} color={colors.textSecondary} />}
                  <Text style={[styles.metaText, { color: item.color || colors.textSecondary }]}>
                    {item.text}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </>
  );

  if (isDocument) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        {body}
        <View style={styles.documentActions}>
          <Pressable
            style={[styles.documentActionButton, { borderColor: colors.borderColor, opacity: documentAction === 'share' ? 0.5 : 1 }]}
            onPress={() => {
              void runDocumentAction('view');
            }}
            disabled={documentAction !== null}
            accessibilityRole="button"
            accessibilityLabel={t('common.preview')}
          >
            <Eye size={16} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={[styles.documentActionButton, { borderColor: colors.borderColor, opacity: documentAction === 'view' ? 0.5 : 1 }]}
            onPress={() => {
              void runDocumentAction('share');
            }}
            disabled={documentAction !== null}
            accessibilityRole="button"
            accessibilityLabel={t('common.share')}
          >
            <Share2 size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {body}
      <ChevronRight size={16} color={colors.textSecondary} style={styles.chevron} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BORDER.radius.md,
    padding: SPACING.sm,
    marginVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageSquare: {
    width: 48,
    height: 48,
    borderRadius: BORDER.radius.sm,
  },
  imageRound: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  content: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 2,
  },
  cardType: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: 1,
  },
  cardSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 2,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  chevron: {
    marginLeft: SPACING.xs,
  },
  documentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  documentActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: BORDER.width.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 4,
    width: '75%',
    marginBottom: 4,
    marginTop: 4,
  },
  skeletonLineShort: {
    height: 10,
    borderRadius: 4,
    width: '50%',
  },
});

export default EntityCard;
