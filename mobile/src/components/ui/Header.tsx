import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { SPACING, TYPOGRAPHY } from '../../constants/theme';
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
    height: 56,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  headerLogo: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },

  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minWidth: 40,
    justifyContent: 'flex-end',
  },
});
