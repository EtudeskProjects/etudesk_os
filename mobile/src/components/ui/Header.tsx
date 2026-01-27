import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { SPACING, TYPOGRAPHY, LAYOUT, ICON } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface HeaderProps {
  title: string;
  rightContent?: React.ReactNode;
}

export function Header({ title, rightContent }: HeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Image
          source={require('../../../assets/etudesk_squared_icon.png')}
          style={styles.headerLogo}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      <View style={styles.headerRight}>
        {rightContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    height: LAYOUT.headerHeight,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  headerLogo: {
    width: ICON.size.xl,
    height: ICON.size.xl,
    resizeMode: 'contain',
  },

  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minWidth: LAYOUT.avatarMd,
    justifyContent: 'flex-end',
  },
});
