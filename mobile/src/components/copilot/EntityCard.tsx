/**
 * EntityCard — Dispatch entity cards from markdown blocks
 * Routes to existing card components based on entity type
 * Left-aligned image/placeholder + content on the right
 */

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Briefcase,
  Users,
  Building2,
  MapPin,
  ChevronRight,
  User,
  FileText,
  Download,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../constants/theme';

interface EntityCardProps {
  type: string;
  data: Record<string, any>;
}

// Resolve image URL from entity data
function getImageUrl(type: string, data: Record<string, any>): string | undefined {
  // Direct imageUrl field (from prompts)
  if (data.imageUrl) return data.imageUrl;
  // Per-entity image fields
  switch (type) {
    case 'opportunity':
      return data.cover_image_url || data.coverImageUrl || (data.images?.[0]);
    case 'community':
      return data.cover_image_url || data.coverImageUrl || (data.images?.[0]);
    case 'space':
      return data.cover_image_url || data.coverImageUrl || (data.gallery_images?.[0]) || (data.galleryImages?.[0]);
    case 'organization':
      return data.logo_url || data.logoUrl;
    case 'talent':
      return data.avatar_url || data.avatarUrl;
    default:
      return undefined;
  }
}

export const EntityCard: React.FC<EntityCardProps> = ({ type, data }) => {
  const { colors } = useTheme();
  const router = useRouter();

  const handlePress = () => {
    const id = data.id;
    if (!id) return;

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
          // Resolve relative URL to absolute
          const url = fileUrl.startsWith('http') ? fileUrl : `${process.env.EXPO_PUBLIC_API_URL || ''}${fileUrl}`;
          Linking.openURL(url);
        }
        break;
      }
    }
  };

  const imageUrl = getImageUrl(type, data);

  // Type badge config
  const typeConfig = {
    opportunity: { icon: Briefcase, color: colors.primary, label: 'Opportunité' },
    community: { icon: Users, color: colors.info, label: 'Communauté' },
    space: { icon: Building2, color: colors.warning, label: 'Espace' },
    organization: { icon: Building2, color: colors.success, label: 'Organisation' },
    talent: { icon: User, color: colors.primary, label: 'Talent' },
    document: { icon: FileText, color: colors.success, label: 'Document' },
  }[type] || { icon: Briefcase, color: colors.textSecondary, label: type };

  const TypeIcon = typeConfig.icon;
  const title = data.title || data.name || data.original_filename || data.filename || '';
  const subtitle = data.organization || data.headline || data.description || undefined;

  // Build meta items
  const metaItems: Array<{ icon?: any; text: string; color?: string }> = [];
  if (data.location || data.city) {
    metaItems.push({ icon: MapPin, text: data.location || data.city });
  }
  if (data.type) {
    metaItems.push({ text: data.type });
  }
  if (data.memberCount !== undefined) {
    metaItems.push({ icon: Users, text: `${data.memberCount} membres` });
  }
  if (data.capacity) {
    metaItems.push({ text: `${data.capacity} places` });
  }
  if (data.hourlyRate) {
    metaItems.push({ text: data.hourlyRate, color: colors.primary });
  }
  if (data.openOpportunities !== undefined) {
    metaItems.push({ text: `${data.openOpportunities} opportunités`, color: colors.primary });
  }
  if (data.topSkills?.length) {
    metaItems.push({ text: data.topSkills.slice(0, 3).join(', ') });
  }

  const isRound = type === 'talent' || type === 'organization';

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
        {/* Type badge + match score */}
        <View style={styles.cardHeader}>
          <Text style={[styles.cardType, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          {data.matchScore != null && (
            <View
              style={[
                styles.scoreBadge,
                {
                  backgroundColor:
                    data.matchScore < 50
                      ? 'rgba(220, 38, 38, 0.15)'
                      : data.matchScore < 70
                        ? 'rgba(202, 138, 4, 0.15)'
                        : 'rgba(22, 163, 74, 0.15)',
                },
              ]}
            >
              <Text
                style={[
                  styles.scoreText,
                  {
                    color:
                      data.matchScore < 50
                        ? '#dc2626'
                        : data.matchScore < 70
                          ? '#ca8a04'
                          : '#16a34a',
                  },
                ]}
              >
                {data.matchScore}%
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>

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
  scoreBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 1,
    borderRadius: BORDER.radius.xs,
  },
  scoreText: {
    fontSize: 10,
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
});

export default EntityCard;
