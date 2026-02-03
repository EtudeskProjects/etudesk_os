/**
 * EntityCard — Dispatch entity cards from markdown blocks
 * Routes to existing card components based on entity type
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Briefcase,
  Users,
  Building2,
  MapPin,
  Star,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../constants/theme';

interface EntityCardProps {
  type: string;
  data: Record<string, any>;
}

export const EntityCard: React.FC<EntityCardProps> = ({ type, data }) => {
  const { colors } = useTheme();
  const router = useRouter();

  const handlePress = () => {
    const id = data.id || data.slug;
    if (!id) return;

    switch (type) {
      case 'opportunity':
        router.push(`/details/opportunity/${data.slug || id}`);
        break;
      case 'community':
        router.push(`/details/community/${data.slug || id}`);
        break;
      case 'space':
        router.push(`/details/space/${data.slug || id}`);
        break;
      case 'organization':
        router.push(`/details/organization/${data.slug || id}`);
        break;
      case 'talent':
        router.push(`/details/talent/${id}`);
        break;
    }
  };

  const renderOpportunity = () => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Briefcase size={16} color={colors.primary} />
        <Text style={[styles.cardType, { color: colors.primary }]}>Opportunité</Text>
        {data.matchScore && (
          <View style={[styles.scoreBadge, { backgroundColor: withOpacity(colors.primary, OPACITY[15]) }]}>
            <Star size={10} color={colors.primary} />
            <Text style={[styles.scoreText, { color: colors.primary }]}>{data.matchScore}%</Text>
          </View>
        )}
      </View>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
        {data.title}
      </Text>
      {data.organization && (
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{data.organization}</Text>
      )}
      <View style={styles.cardMeta}>
        {data.location && (
          <View style={styles.metaItem}>
            <MapPin size={12} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{data.location}</Text>
          </View>
        )}
        {data.type && (
          <View style={[styles.badge, { backgroundColor: colors.surface }]}>
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{data.type}</Text>
          </View>
        )}
      </View>
      <ChevronRight
        size={16}
        color={colors.textSecondary}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );

  const renderCommunity = () => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Users size={16} color={colors.info} />
        <Text style={[styles.cardType, { color: colors.info }]}>Communauté</Text>
      </View>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
        {data.name}
      </Text>
      {data.organization && (
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{data.organization}</Text>
      )}
      <View style={styles.cardMeta}>
        {data.memberCount !== undefined && (
          <View style={styles.metaItem}>
            <Users size={12} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {data.memberCount} membres
            </Text>
          </View>
        )}
        {data.type && (
          <View style={[styles.badge, { backgroundColor: colors.surface }]}>
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{data.type}</Text>
          </View>
        )}
      </View>
      <ChevronRight size={16} color={colors.textSecondary} style={styles.chevron} />
    </TouchableOpacity>
  );

  const renderSpace = () => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Building2 size={16} color={colors.warning} />
        <Text style={[styles.cardType, { color: colors.warning }]}>Espace</Text>
      </View>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
        {data.name}
      </Text>
      {data.organization && (
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{data.organization}</Text>
      )}
      <View style={styles.cardMeta}>
        {data.city && (
          <View style={styles.metaItem}>
            <MapPin size={12} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{data.city}</Text>
          </View>
        )}
        {data.capacity && (
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {data.capacity} places
          </Text>
        )}
        {data.hourlyRate && (
          <Text style={[styles.metaText, { color: colors.primary }]}>{data.hourlyRate}</Text>
        )}
      </View>
      <ChevronRight size={16} color={colors.textSecondary} style={styles.chevron} />
    </TouchableOpacity>
  );

  const renderOrganization = () => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Building2 size={16} color={colors.success} />
        <Text style={[styles.cardType, { color: colors.success }]}>Organisation</Text>
      </View>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
        {data.name}
      </Text>
      <View style={styles.cardMeta}>
        {data.location && (
          <View style={styles.metaItem}>
            <MapPin size={12} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{data.location}</Text>
          </View>
        )}
        {data.openOpportunities !== undefined && (
          <Text style={[styles.metaText, { color: colors.primary }]}>
            {data.openOpportunities} opportunités
          </Text>
        )}
      </View>
      <ChevronRight size={16} color={colors.textSecondary} style={styles.chevron} />
    </TouchableOpacity>
  );

  const renderTalent = () => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Users size={16} color={colors.primary} />
        <Text style={[styles.cardType, { color: colors.primary }]}>Talent</Text>
      </View>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
        {data.name}
      </Text>
      {data.headline && (
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {data.headline}
        </Text>
      )}
      <View style={styles.cardMeta}>
        {data.location && (
          <View style={styles.metaItem}>
            <MapPin size={12} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{data.location}</Text>
          </View>
        )}
        {data.topSkills && (
          <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
            {data.topSkills.slice(0, 3).join(', ')}
          </Text>
        )}
      </View>
      <ChevronRight size={16} color={colors.textSecondary} style={styles.chevron} />
    </TouchableOpacity>
  );

  // Generic fallback
  const renderGeneric = () => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      <Text style={[styles.cardType, { color: colors.textSecondary }]}>{type}</Text>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
        {data.title || data.name || JSON.stringify(data).slice(0, 100)}
      </Text>
    </View>
  );

  switch (type) {
    case 'opportunity':
      return renderOpportunity();
    case 'community':
      return renderCommunity();
    case 'space':
      return renderSpace();
    case 'organization':
      return renderOrganization();
    case 'talent':
      return renderTalent();
    default:
      return renderGeneric();
  }
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BORDER.radius.md,
    padding: SPACING.md,
    marginVertical: SPACING.xs,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  cardType: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    flex: 1,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER.radius.xs,
  },
  scoreText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: 2,
    paddingRight: SPACING.lg,
  },
  cardSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: SPACING.xs,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
    marginTop: SPACING.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  badge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER.radius.xs,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  chevron: {
    position: 'absolute',
    right: SPACING.md,
    top: SPACING.md + 16,
  },
});

export default EntityCard;
