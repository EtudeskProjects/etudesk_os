import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StyleProp,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, ICON, LAYOUT } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../contexts/I18nContext';
import { ScrollToInputContext } from '../../contexts/ScrollToInputContext';
import { IconButton } from './IconButton';
import { LoadingShimmer } from './LoadingShimmer';

interface PageLayoutProps {
  title: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  scrollEnabled?: boolean;
  headerContent?: React.ReactNode;
  isLoading?: boolean;
  /**
   * By default PageLayout wraps content in a ScrollView.
   * For large lists, set false and render your own FlatList/SectionList as children.
   */
  useScrollView?: boolean;
  /** Style for the body wrapper when useScrollView is false */
  bodyStyle?: StyleProp<ViewStyle>;
  /** Extra style applied to ScrollView content container (when useScrollView is true) */
  scrollContentStyle?: StyleProp<ViewStyle>;
}

export function PageLayout({
  title,
  onRefresh,
  isRefreshing = false,
  rightAction,
  children,
  scrollEnabled = true,
  headerContent,
  isLoading = false,
  useScrollView = true,
  bodyStyle,
  scrollContentStyle,
}: PageLayoutProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);

  const scrollToInput = useCallback((targetNodeHandle: number, extraOffset = 96) => {
    const sv = scrollRef.current;
    if (!sv) return;

    const delay = Platform.OS === 'android' ? 120 : 0;
    setTimeout(() => {
      // RN ScrollView responder helper; not in public TS types.
      sv.scrollResponderScrollNativeHandleToKeyboard(targetNodeHandle, extraOffset, true);
    }, delay);
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <IconButton
            onPress={() => router.back()}
            icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
            accessibilityLabel={t('common.back')}
          />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingShimmer variant="fullPage" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton
          onPress={() => router.back()}
          icon={<ArrowLeft size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
          accessibilityLabel={t('common.back')}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{title}</Text>
        {rightAction || <View style={styles.headerSpacer} />}
      </View>

      {headerContent}

      {useScrollView ? (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollToInputContext.Provider value={scrollToInput}>
            <ScrollView
              ref={scrollRef}
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
              showsVerticalScrollIndicator={false}
              scrollEnabled={scrollEnabled}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              refreshControl={
                onRefresh ? (
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    tintColor={colors.primary}
                    colors={[colors.primary]}
                  />
                ) : undefined
              }
            >
              {children}
            </ScrollView>
          </ScrollToInputContext.Provider>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.body, bodyStyle]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: { fontFamily: TYPOGRAPHY.fontFamily.semibold, fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  headerSpacer: { width: LAYOUT.inputHeightSm },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xxl },
  body: { flex: 1 },
});
