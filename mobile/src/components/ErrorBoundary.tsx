/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the app
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { AlertTriangle, RefreshCw, Bug, Share2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER, ICON } from '../constants/theme';
import { logger } from '../services/logService';
import { ErrorSeverity } from '../types/errors';

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
        title: 'Rapport d\'erreur Etudesk',
      });
    } catch (e) {
      Alert.alert('Erreur', errorText);
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
              <AlertTriangle size={48} color={COLORS.error} strokeWidth={1.5} />
            </View>

            {/* Title */}
            <Text style={styles.title}>Oups ! Une erreur s'est produite</Text>
            <Text style={styles.subtitle}>
              Nous sommes désolés, quelque chose s'est mal passé.
            </Text>

            {/* Error message (simplified for users) */}
            <View style={styles.errorBox}>
              <Text style={styles.errorMessage} numberOfLines={showFullError ? undefined : 2}>
                {error?.message || 'Erreur inconnue'}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={this.handleRetry}
                activeOpacity={0.8}
              >
                <RefreshCw size={ICON.size.sm} color={COLORS.white} strokeWidth={ICON.strokeWidth} />
                <Text style={styles.primaryButtonText}>Réessayer</Text>
              </TouchableOpacity>
            </View>

            {/* Developer details (only in dev mode) */}
            {showDetails && (
              <View style={styles.devSection}>
                <TouchableOpacity
                  style={styles.devToggle}
                  onPress={this.toggleFullError}
                  activeOpacity={0.7}
                >
                  <Bug size={ICON.size.sm} color={COLORS.gray600} strokeWidth={ICON.strokeWidth} />
                  <Text style={styles.devToggleText}>Détails techniques</Text>
                  {showFullError ? (
                    <ChevronUp size={ICON.size.sm} color={COLORS.gray600} strokeWidth={ICON.strokeWidth} />
                  ) : (
                    <ChevronDown size={ICON.size.sm} color={COLORS.gray600} strokeWidth={ICON.strokeWidth} />
                  )}
                </TouchableOpacity>

                {showFullError && (
                  <View style={styles.devDetails}>
                    <ScrollView style={styles.stackScroll} nestedScrollEnabled>
                      <Text style={styles.stackTitle}>Stack Trace:</Text>
                      <Text style={styles.stackText}>{error?.stack}</Text>

                      {errorInfo?.componentStack && (
                        <>
                          <Text style={styles.stackTitle}>Component Stack:</Text>
                          <Text style={styles.stackText}>{errorInfo.componentStack}</Text>
                        </>
                      )}
                    </ScrollView>

                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={this.handleShareError}
                      activeOpacity={0.7}
                    >
                      <Share2 size={ICON.size.sm} color={COLORS.primary} strokeWidth={ICON.strokeWidth} />
                      <Text style={styles.copyButtonText}>Partager l'erreur</Text>
                    </TouchableOpacity>
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
          <AlertTriangle size={32} color={COLORS.warning} strokeWidth={1.5} />
          <Text style={styles.screenErrorTitle}>Erreur de chargement</Text>
          <Text style={styles.screenErrorMessage}>
            Cette page n'a pas pu être chargée.
          </Text>
          <View style={styles.screenErrorActions}>
            <TouchableOpacity
              style={styles.screenErrorButton}
              onPress={this.handleRetry}
            >
              <RefreshCw size={16} color={COLORS.primary} strokeWidth={2} />
              <Text style={styles.screenErrorButtonText}>Réessayer</Text>
            </TouchableOpacity>
            {this.props.onGoBack && (
              <TouchableOpacity
                style={[styles.screenErrorButton, styles.screenErrorButtonSecondary]}
                onPress={this.props.onGoBack}
              >
                <Text style={styles.screenErrorButtonTextSecondary}>Retour</Text>
              </TouchableOpacity>
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
    backgroundColor: COLORS.background,
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
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.gray600,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },

  errorBox: {
    backgroundColor: COLORS.error + '10',
    borderRadius: BORDER.radius.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    width: '100%',
  },

  errorMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
    fontFamily: 'monospace',
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
    backgroundColor: COLORS.primary,
  },

  primaryButtonText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },

  devSection: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
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
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.gray600,
  },

  devDetails: {
    marginTop: SPACING.md,
  },

  stackScroll: {
    maxHeight: 200,
    backgroundColor: COLORS.gray100,
    borderRadius: BORDER.radius.sm,
    padding: SPACING.md,
  },

  stackTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },

  stackText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.gray600,
    fontFamily: 'monospace',
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
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  // Screen error boundary styles
  screenErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },

  screenErrorTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.gray900,
    marginTop: SPACING.md,
  },

  screenErrorMessage: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.gray600,
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
    backgroundColor: COLORS.primary + '10',
  },

  screenErrorButtonSecondary: {
    backgroundColor: COLORS.gray100,
  },

  screenErrorButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
  },

  screenErrorButtonTextSecondary: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.gray700,
  },
});

export default ErrorBoundary;
