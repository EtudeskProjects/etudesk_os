/**
 * CardImage - Image section with placeholder support
 */

import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { ICON, LAYOUT } from '../../../constants/theme';
import { getFullImageUrl } from '../../../utils/image';

export interface CardImageProps {
  /** Image URL */
  imageUrl?: string | null;
  /** Icon to show when no image */
  PlaceholderIcon: LucideIcon;
  /** Custom height */
  height?: number;
  /** Children (for overlays like badges) */
  children?: React.ReactNode;
  /** Custom style */
  style?: ViewStyle;
}

export const CardImage: React.FC<CardImageProps> = ({
  imageUrl,
  PlaceholderIcon,
  height = LAYOUT.cardImageHeightSm,
  children,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { height }, style]}>
      {imageUrl ? (
        <Image
          source={{ uri: getFullImageUrl(imageUrl) || '' }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: colors.gray100 }]}>
          <PlaceholderIcon
            size={ICON.size.xl}
            color={colors.gray400}
            strokeWidth={ICON.strokeWidth}
          />
        </View>
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
