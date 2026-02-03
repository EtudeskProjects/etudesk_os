/**
 * TalentCard - Refactored to use BaseCard components
 * Horizontal layout with avatar, content and rating
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { User, MapPin, Briefcase, Star } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, LAYOUT } from '../../constants/theme';
import { CardContainer } from './BaseCard';

export interface TalentCardData {
  id: string;
  display_name: string;
  title?: string;
  avatar_url?: string;
  city?: string;
  country?: string;
  skills?: string[];
  email?: string;
  rating?: number;
}

interface TalentCardProps {
  talent: TalentCardData;
  onPress?: () => void;
  compact?: boolean;
}

export const TalentCard: React.FC<TalentCardProps> = ({
  talent,
  onPress,
  compact = false,
}) => {
  const { colors } = useTheme();
  const location = [talent.city, talent.country].filter(Boolean).join(', ');

  return (
    <CardContainer
      onPress={onPress}
      horizontal
      style={{ backgroundColor: colors.cardTalent, borderColor: colors.cardTalentAccent }}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {talent.avatar_url ? (
          <Image source={{ uri: talent.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.cardTalentAccent }]}>
            <User size={ICON.size.lg} color={colors.cardTalentText} strokeWidth={ICON.strokeWidth} />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {talent.display_name}
        </Text>

        {talent.title && (
          <View style={styles.row}>
            <Briefcase size={12} color={colors.cardTalentText} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.subtitle, { color: colors.cardTalentText }]} numberOfLines={1}>
              {talent.title}
            </Text>
          </View>
        )}

        {location && (
          <View style={styles.row}>
            <MapPin size={12} color={colors.cardTalentText} strokeWidth={ICON.strokeWidth} />
            <Text style={[styles.meta, { color: colors.cardTalentText }]} numberOfLines={1}>
              {location}
            </Text>
          </View>
        )}

        {/* Skills chips */}
        {!compact && talent.skills && talent.skills.length > 0 && (
          <View style={styles.skillsContainer}>
            {talent.skills.slice(0, 3).map((skill, index) => (
              <View
                key={index}
                style={[styles.skillChip, { backgroundColor: colors.cardTalentAccent }]}
              >
                <Text style={[styles.skillText, { color: colors.cardTalentText }]}>
                  {skill}
                </Text>
              </View>
            ))}
            {talent.skills.length > 3 && (
              <Text style={[styles.moreSkills, { color: colors.cardTalentText }]}>
                +{talent.skills.length - 3}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Rating */}
      {talent.rating !== undefined && talent.rating > 0 && (
        <View style={styles.ratingContainer}>
          <Star size={12} color={colors.warning} fill={colors.warning} strokeWidth={ICON.strokeWidth} />
          <Text style={[styles.rating, { color: colors.textPrimary }]}>
            {talent.rating.toFixed(1)}
          </Text>
        </View>
      )}
    </CardContainer>
  );
};

const styles = StyleSheet.create({
  avatarContainer: {
    marginRight: SPACING.md,
  },
  avatar: {
    width: LAYOUT.avatarLg,
    height: LAYOUT.avatarLg,
    borderRadius: LAYOUT.avatarLg / 2,
  },
  avatarPlaceholder: {
    width: LAYOUT.avatarLg,
    height: LAYOUT.avatarLg,
    borderRadius: LAYOUT.avatarLg / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  name: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  meta: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    flex: 1,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
    alignItems: 'center',
  },
  skillChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER.radius.full,
  },
  skillText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 10,
  },
  moreSkills: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rating: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});

export default TalentCard;
