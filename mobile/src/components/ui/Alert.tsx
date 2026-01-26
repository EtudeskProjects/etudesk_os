import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from 'react-native';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  X,
} from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER, ICON } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type AlertType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertProps {
  visible: boolean;
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onClose: () => void;
  dismissable?: boolean;
}

const ALERT_ICONS: Record<AlertType, React.ComponentType<any>> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  confirm: AlertCircle,
};

export function Alert({
  visible,
  type = 'info',
  title,
  message,
  buttons,
  onClose,
  dismissable = true,
}: AlertProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'error':
        return colors.error;
      case 'warning':
        return colors.warning;
      case 'info':
      case 'confirm':
      default:
        return colors.info;
    }
  };

  const getIconBackgroundColor = () => {
    switch (type) {
      case 'success':
        return `${colors.success}15`;
      case 'error':
        return `${colors.error}15`;
      case 'warning':
        return `${colors.warning}15`;
      case 'info':
      case 'confirm':
      default:
        return `${colors.info}15`;
    }
  };

  const IconComponent = ALERT_ICONS[type];

  const defaultButtons: AlertButton[] = buttons || [
    { text: 'OK', onPress: onClose },
  ];

  const handleBackdropPress = () => {
    if (dismissable) {
      onClose();
    }
  };

  const handleButtonPress = (button: AlertButton) => {
    button.onPress?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismissable ? onClose : undefined}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.container,
                {
                  backgroundColor: colors.surface,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* Close button */}
              {dismissable && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X
                    size={ICON.size.md}
                    color={colors.textSecondary}
                    strokeWidth={ICON.strokeWidth}
                  />
                </TouchableOpacity>
              )}

              {/* Icon */}
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: getIconBackgroundColor() },
                ]}
              >
                <IconComponent
                  size={32}
                  color={getIconColor()}
                  strokeWidth={ICON.strokeWidth}
                />
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {title}
              </Text>

              {/* Message */}
              {message && (
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                  {message}
                </Text>
              )}

              {/* Buttons */}
              <View style={[
                styles.buttonsContainer,
                defaultButtons.length === 1 && styles.buttonsContainerCentered
              ]}>
                {defaultButtons.map((button, index) => {
                  const isCancel = button.style === 'cancel';
                  const isDestructive = button.style === 'destructive';

                  return (
                    <View
                      key={index}
                      style={[
                        styles.buttonWrapper,
                        defaultButtons.length > 1 && { flex: 1 },
                      ]}
                    >
                      <Button
                        title={button.text}
                        onPress={() => handleButtonPress(button)}
                        variant={isCancel ? 'outline' : 'primary'}
                        fullWidth
                        style={
                          isDestructive
                            ? { backgroundColor: colors.error }
                            : undefined
                        }
                      />
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  container: {
    width: Math.min(SCREEN_WIDTH - SPACING.lg * 2, 340),
    borderRadius: BORDER.radius.md,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    zIndex: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BORDER.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.lg,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.sm,
  },
  buttonsContainerCentered: {
    justifyContent: 'center',
  },
  buttonWrapper: {
    minWidth: 100,
  },
});
