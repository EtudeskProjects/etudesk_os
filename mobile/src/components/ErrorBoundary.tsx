/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the app
 *
 * Note: Uses hardcoded theme values as error boundaries must work
 * independently of theme context (which may be unavailable during errors)
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Share,
  Alert,
  Pressable,
} from 'react-native';
import { AlertTriangle, RefreshCw, Bug, Share2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, ICON, LIGHT_COLORS, OPACITY, withOpacity } from '../constants/theme';
import { logger } from '../services/logService';
import i18n from '../i18n';


// ErrorBoundary must not depend on theme context. Use static light palette tokens.
const ERROR_COLORS = LIGHT_COLORS;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showFullError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showFullError: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to our centralized service
    logger.critical('ErrorBoundary', `Uncaught error: ${error.message}`, error, {
      componentStack: errorInfo.componentStack,
    });

    this.setState({ errorInfo });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showFullError: false,
    });
  };

  handleShareError = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    const errorText = `
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
Time: ${new Date().toISOString()}
    `.trim();

    try {
      await Share.share({
        message: errorText,
        title: i18n.t('errorBoundary.errorReportTitle'),
      });
    } catch (e) {
      Alert.alert(i18n.t('common.error'), errorText);
    }
  };

  toggleFullError = (): void => {
    this.setState((prev) => ({ showFullError: !prev.showFullError }));
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, showFullError } = this.state;
    const { children, fallback, showDetails = __DEV__ } = this.props;

    if (hasError) {
      // Custom fallback UI if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <AlertTriangle size={48} color={ERROR_COLORS.error} strokeWidth={1.5} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{i18n.t('errorBoundary.title')}</Text>
            <Text style={styles.subtitle}>
              {i18n.t('errorBoundary.subtitle')}
            </Text>

            {/* Error message (simplified for users) */}
            <View style={styles.errorBox}>
              <Text style={styles.errorMessage} numberOfLines={showFullError ? undefined : 2}>
                {error?.message || i18n.t('errorBoundary.unknownError')}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.primaryButton,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={this.handleRetry}
                accessibilityRole="button"
              >
                <RefreshCw size={ICON.size.sm} color={ERROR_COLORS.white} strokeWidth={ICON.strokeWidth} />
                <Text style={styles.primaryButtonText}>{i18n.t('common.retry')}</Text>
              </Pressable>
            </View>

            {/* Developer details (only in dev mode) */}
            {showDetails && (
              <View style={styles.devSection}>
                <Pressable
                  style={({ pressed }) => [styles.devToggle, pressed && { opacity: 0.85 }]}
                  onPress={this.toggleFullError}
                  accessibilityRole="button"
                >
                  <Bug size={ICON.size.sm} color={ERROR_COLORS.gray600} strokeWidth={ICON.strokeWidth} />
                  <Text style={styles.devToggleText}>{i18n.t('errorBoundary.technicalDetails')}</Text>
                  {showFullError ? (
                    <ChevronUp size={ICON.size.sm} color={ERROR_COLORS.gray600} strokeWidth={ICON.strokeWidth} />
                  ) : (
                    <ChevronDown size={ICON.size.sm} color={ERROR_COLORS.gray600} strokeWidth={ICON.strokeWidth} />
                  )}
                </Pressable>

                {showFullError && (
                  <View style={styles.devDetails}>
                    <ScrollView style={styles.stackScroll} nestedScrollEnabled>
                      <Text style={styles.stackTitle}>{i18n.t('errorBoundary.stackTrace')}</Text>
                      <Text style={styles.stackText}>{error?.stack}</Text>

                      {errorInfo?.componentStack && (
                        <>
                          <Text style={styles.stackTitle}>{i18n.t('errorBoundary.componentStack')}</Text>
                          <Text style={styles.stackText}>{errorInfo.componentStack}</Text>
                        </>
                      )}
                    </ScrollView>

                    <Pressable
                      style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.85 }]}
                      onPress={this.handleShareError}
                      accessibilityRole="button"
                    >
                      <Share2 size={ICON.size.sm} color={ERROR_COLORS.primary} strokeWidth={ICON.strokeWidth} />
                      <Text style={styles.copyButtonText}>{i18n.t('errorBoundary.shareError')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      );
    }

    return children;
  }
}

/**
 * Screen-level error boundary with navigation context
 */
interface ScreenErrorBoundaryProps {
  children: ReactNode;
  screenName?: string;
  onGoBack?: () => void;
}

export class ScreenErrorBoundary extends Component<
  ScreenErrorBoundaryProps,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: ScreenErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(
      `Screen:${this.props.screenName || 'Unknown'}`,
      `Screen crash: ${error.message}`,
      error,
      { componentStack: errorInfo.componentStack }
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.screenErrorContainer}>
          <AlertTriangle size={32} color={ERROR_COLORS.warning} strokeWidth={1.5} />
          <Text style={styles.screenErrorTitle}>{i18n.t('errorBoundary.loadError')}</Text>
          <Text style={styles.screenErrorMessage}>
            {i18n.t('errorBoundary.pageLoadError')}
          </Text>
          <View style={styles.screenErrorActions}>
            <Pressable
              style={({ pressed }) => [styles.screenErrorButton, pressed && { opacity: 0.85 }]}
              onPress={this.handleRetry}
              accessibilityRole="button"
            >
              <RefreshCw size={16} color={ERROR_COLORS.primary} strokeWidth={2} />
              <Text style={styles.screenErrorButtonText}>{i18n.t('common.retry')}</Text>
            </Pressable>
            {this.props.onGoBack && (
              <Pressable
                style={({ pressed }) => [
                  styles.screenErrorButton,
                  styles.screenErrorButtonSecondary,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={this.props.onGoBack}
                accessibilityRole="button"
              >
                <Text style={styles.screenErrorButtonTextSecondary}>{i18n.t('common.back')}</Text>
              </Pressable>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ERROR_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },

  content: {
    alignItems: 'center',
    maxWidth: 400,
  },

  iconContainer: {
    marginBottom: SPACING.lg,
  },

  title: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: ERROR_COLORS.gray900,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    color: ERROR_COLORS.gray600,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },

  errorBox: {
    backgroundColor: withOpacity(ERROR_COLORS.error, OPACITY[10]),
    borderRadius: BORDER.radius.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    width: '100%',
  },

  errorMessage: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: ERROR_COLORS.error,
  },

  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER.radius.md,
  },

  primaryButton: {
    backgroundColor: ERROR_COLORS.primary,
  },

  primaryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: ERROR_COLORS.white,
  },

  devSection: {
    width: '100%',
    borderTopWidth: BORDER.width.thin,
    borderTopColor: ERROR_COLORS.gray200,
    paddingTop: SPACING.md,
  },

  devToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },

  devToggleText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: ERROR_COLORS.gray600,
  },

  devDetails: {
    marginTop: SPACING.md,
  },

  stackScroll: {
    maxHeight: 200,
    backgroundColor: ERROR_COLORS.gray100,
    borderRadius: BORDER.radius.sm,
    padding: SPACING.md,
  },

  stackTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: ERROR_COLORS.gray700,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },

  stackText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: ERROR_COLORS.gray600,
  },

  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },

  copyButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: ERROR_COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Screen error boundary styles
  screenErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: ERROR_COLORS.background,
  },

  screenErrorTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: ERROR_COLORS.gray900,
    marginTop: SPACING.md,
  },

  screenErrorMessage: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: ERROR_COLORS.gray600,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  screenErrorActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  screenErrorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.sm,
    backgroundColor: withOpacity(ERROR_COLORS.primary, OPACITY[10]),
  },

  screenErrorButtonSecondary: {
    backgroundColor: ERROR_COLORS.gray100,
  },

  screenErrorButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: ERROR_COLORS.primary,
  },

  screenErrorButtonTextSecondary: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: ERROR_COLORS.gray700,
  },
});

export default ErrorBoundary;
