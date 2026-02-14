import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '../../src/hooks/useTheme';
import { LoadingShimmer } from '../../src/components/ui';
import { SPACING, TYPOGRAPHY } from '../../src/constants/theme';

export default function BillingCallbackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ reference?: string | string[] }>();

  useEffect(() => {
    const reference = Array.isArray(params.reference) ? params.reference[0] : params.reference;

    if (reference) {
      router.replace({
        pathname: '/settings/credits' as any,
        params: { reference },
      });
      return;
    }

    router.replace('/settings/credits' as any);
  }, [params.reference, router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <LoadingShimmer variant="fullPage" label="Validation du paiement..." />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  text: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
