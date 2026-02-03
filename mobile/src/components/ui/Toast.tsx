/**
 * Toast Component - Lightweight notification system
 *
 * Features:
 * - Auto-dismiss with configurable duration
 * - Multiple toast types (success, error, warning, info)
 * - Swipe to dismiss
 * - Queue support for multiple toasts
 * - Accessible
 */

import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, ICON, Z_INDEX, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Toast configuration
export interface ToastConfig {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onDismiss?: () => void;
}

// Toast context type
interface ToastContextType {
  showToast: (config: Omit<ToastConfig, 'id'>) => void;
  hideToast: (id: string) => void;
  hideAll: () => void;
}

// Create context
const ToastContext = createContext<ToastContextType | null>(null);

// Toast item component
const ToastItem: React.FC<{
  toast: ToastConfig;
  onDismiss: () => void;
}> = ({ toast, onDismiss }) => {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Get icon and colors based on type
  const getToastConfig = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: CheckCircle,
          iconColor: colors.success,
          bgColor: colors.successLight,
          borderColor: colors.success,
        };
      case 'error':
        return {
          icon: XCircle,
          iconColor: colors.error,
          bgColor: colors.errorLight,
          borderColor: colors.error,
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconColor: colors.warning,
          bgColor: colors.warningLight,
          borderColor: colors.warning,
        };
      case 'info':
      default:
        return {
          icon: Info,
          iconColor: colors.info,
          bgColor: colors.infoLight,
          borderColor: colors.info,
        };
    }
  };

  const config = getToastConfig();
  const Icon = config.icon;

  // Pan responder for swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          translateX.setValue(gestureState.dx);
          opacity.setValue(1 - gestureState.dx / SCREEN_WIDTH);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SCREEN_WIDTH * 0.3) {
          // Dismiss
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(onDismiss);
        } else {
          // Return to position
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
          Animated.spring(opacity, {
            toValue: 1,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Enter animation
  useEffect(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [translateX]);

  // Auto-dismiss timer
  useEffect(() => {
    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(onDismiss);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [toast.duration, translateX, opacity, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          backgroundColor: config.bgColor,
          borderLeftColor: config.borderColor,
          transform: [{ translateX }, { translateY }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={`${toast.type}: ${toast.title}${toast.message ? `. ${toast.message}` : ''}`}
    >
      <View style={styles.toastContent}>
        <Icon
          size={ICON.size.md}
          color={config.iconColor}
          strokeWidth={ICON.strokeWidth}
        />
        <View style={styles.toastTextContainer}>
          <Text style={[styles.toastTitle, { color: colors.textPrimary }]}>
            {toast.title}
          </Text>
          {toast.message && (
            <Text style={[styles.toastMessage, { color: colors.textSecondary }]} numberOfLines={2}>
              {toast.message}
            </Text>
          )}
        </View>
        <X
          size={ICON.size.sm}
          color={colors.gray400}
          strokeWidth={ICON.strokeWidth}
        />
      </View>
    </Animated.View>
  );
};

// Toast provider component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);
  const insets = useSafeAreaInsets();

  // Generate unique ID
  const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Show a new toast
  const showToast = useCallback((config: Omit<ToastConfig, 'id'>) => {
    const id = generateId();
    setToasts(prev => [...prev, { ...config, id }]);
  }, []);

  // Hide a specific toast
  const hideToast = useCallback((id: string) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      if (toast?.onDismiss) {
        toast.onDismiss();
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  // Hide all toasts
  const hideAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast, hideAll }}>
      {children}
      {/* Toast container */}
      <View style={[styles.container, { top: insets.top + SPACING.md }]} pointerEvents="box-none">
        {toasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => hideToast(toast.id)}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

// Hook to use toast
export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Helper functions for common toast types
export const toast = {
  success: (title: string, message?: string, duration?: number) => {
    // This will only work inside a component that uses useToast
    // For convenience, we export the type for external use
    return { type: 'success' as ToastType, title, message, duration };
  },
  error: (title: string, message?: string, duration?: number) => {
    return { type: 'error' as ToastType, title, message, duration };
  },
  warning: (title: string, message?: string, duration?: number) => {
    return { type: 'warning' as ToastType, title, message, duration };
  },
  info: (title: string, message?: string, duration?: number) => {
    return { type: 'info' as ToastType, title, message, duration };
  },
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: Z_INDEX.toast,
    gap: SPACING.sm,
  },
  toastContainer: {
    borderRadius: BORDER.radius.md,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  toastTextContainer: {
    flex: 1,
  },
  toastTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  toastMessage: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: SPACING.xxs,
  },
});

export default ToastProvider;
