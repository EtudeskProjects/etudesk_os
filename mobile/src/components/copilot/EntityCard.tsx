/**
 * EntityCard — Smart entity cards that auto-fetch data from API
 * Receives {"id":"uuid"} from copilot, fetches full entity data, renders rich card
 * Routes to detail pages on press
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Briefcase,
  Users,
  Building2,
  MapPin,
  ChevronRight,
  User,
  FileText,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../constants/theme';
import { api } from '../../services/api';

interface EntityCardProps {
  type: string;
  data: Record<string, any>;
}

/** API endpoint for each entity type */
const ENTITY_ENDPOINTS: Record<string, string> = {
  opportunity: '/api/opportunities',
  community: '/api/communities',
  space: '/api/spaces',
  organization: '/api/organizations',
  talent: '/api/talents',
  document: '/api/documents',
};

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
        hourlyRate: raw.hourly_rate ? `${raw.hourly_rate} FCFA/h` : undefined,
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
        file_url: raw.file_url,
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
    default:
      return undefined;
  }
}

export const EntityCard: React.FC<EntityCardProps> = ({ type, data: initialData }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const [entityData, setEntityData] = useState<Record<string, any>>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Auto-fetch entity data when only id is provided
  useEffect(() => {
    if (!needsFetch(initialData)) return;

    const endpoint = ENTITY_ENDPOINTS[type];
    if (!endpoint || !initialData.id) return;

    let cancelled = false;
    setLoading(true);

    api.get<any>(`${endpoint}/${initialData.id}`)
      .then((response) => {
        if (cancelled) return;
        const raw = response.data || response;
        const normalized = normalizeEntity(type, raw);
        setEntityData({ ...initialData, ...normalized });
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

  const data = entityData;

  const handlePress = () => {
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
      case 'document': {
        const fileUrl = data.file_url || data.downloadUrl;
        if (fileUrl) {
          const url = fileUrl.startsWith('http') ? fileUrl : `${process.env.EXPO_PUBLIC_API_URL || ''}${fileUrl}`;
          Linking.openURL(url);
        } else {
          // No file URL yet, navigate to document details or just press through
          router.push(`/details/document/${id}` as any);
        }
        break;
      }
    }
  };

  const imageUrl = getImageUrl(type, data);

  // Type badge config
  const typeConfig = {
    opportunity: { icon: Briefcase, color: colors.primary, label: t('copilot.entity.opportunity') },
    community: { icon: Users, color: colors.info, label: t('copilot.entity.community') },
    space: { icon: Building2, color: colors.warning, label: t('copilot.entity.space') },
    organization: { icon: Building2, color: colors.success, label: t('copilot.entity.organization') },
    talent: { icon: User, color: colors.primary, label: t('copilot.entity.talent') },
    document: { icon: FileText, color: colors.success, label: t('copilot.entity.document') },
  }[type] || { icon: Briefcase, color: colors.textSecondary, label: type };

  const TypeIcon = typeConfig.icon;
  const title = data.title || data.name || data.original_filename || data.filename || '';
  const subtitle = data.subtitle || data.organization?.name || data.organizations?.[0]?.name || data.headline || data.description?.slice(0, 80) || undefined;

  // Build meta items
  const metaItems: Array<{ icon?: any; text: string; color?: string }> = [];
  if (data.location || data.city) {
    metaItems.push({ icon: MapPin, text: data.location || data.city });
  }
  if (data.metaType || data.type) {
    metaItems.push({ text: data.metaType || data.type });
  }
  if (data.memberCount !== undefined || data.members_count !== undefined) {
    const count = data.memberCount ?? data.members_count;
    metaItems.push({ icon: Users, text: `${count} membres` });
  }
  if (data.capacity) {
    metaItems.push({ text: `${data.capacity} places` });
  }
  if (data.hourlyRate || data.hourly_rate) {
    const rate = data.hourlyRate || `${data.hourly_rate} FCFA/h`;
    metaItems.push({ text: rate, color: colors.primary });
  }
  if (data.topSkills?.length) {
    metaItems.push({ text: data.topSkills.slice(0, 3).join(', ') });
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
        <ActivityIndicator size="small" color={typeConfig.color} />
      </View>
    );
  }

  // Error state — still tappable to navigate to detail
  if (error && !title) {
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
        onPress={handlePress}
        activeOpacity={0.7}
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
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Left: Image or placeholder */}
      <View
        style={[
          styles.imageContainer,
          isRound ? styles.imageRound : styles.imageSquare,
          { backgroundColor: withOpacity(typeConfig.color, OPACITY[10]) },
        ]}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={isRound ? styles.imageRound : styles.imageSquare}
            resizeMode="cover"
          />
        ) : (
          <TypeIcon size={20} color={typeConfig.color} />
        )}
      </View>

      {/* Right: Content */}
      <View style={styles.content}>
        {/* Type badge */}
        <View style={styles.cardHeader}>
          <Text style={[styles.cardType, { color: typeConfig.color }]}>{typeConfig.label}</Text>
        </View>

        {/* Title */}
        {title ? (
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}

        {/* Subtitle */}
        {subtitle ? (
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}

        {/* Meta */}
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

      {/* Chevron */}
      <ChevronRight size={16} color={colors.textSecondary} style={styles.chevron} />
    </TouchableOpacity>
  );
};

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
