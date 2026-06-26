import { View, Text, StyleSheet } from 'react-native';
import { SPACING, TYPOGRAPHY, LAYOUT, ICON, BORDER } from '../../constants/theme';
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
        {/* Monogramme monochrome (charte noir & blanc) — remplace l'ancien icone marron */}
        <View style={[styles.headerLogo, { backgroundColor: colors.primary }]}>
          <Text style={[styles.headerLogoText, { color: colors.textOnPrimary }]}>lk</Text>
        </View>
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
    borderRadius: BORDER.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerLogoText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    letterSpacing: -0.5,
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
