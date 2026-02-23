import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, ICON, LAYOUT } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../contexts/I18nContext';
import { Button } from './Button';
import { IconButton } from './IconButton';

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
  const { t } = useI18n();
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
        <Animated.View style={[styles.overlay, { backgroundColor: colors.overlay, opacity: fadeAnim }]}>
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
                <IconButton
                  onPress={onClose}
                  icon={<X size={ICON.size.md} color={colors.textSecondary} strokeWidth={ICON.strokeWidth} />}
                  accessibilityLabel={t('common.close')}
                  style={styles.closeButton}
                />
              )}

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

              {/* Buttons — always vertical, full width */}
              <View style={styles.buttonsContainer}>
                {defaultButtons.map((button, index) => {
                  const isCancel = button.style === 'cancel';
                  const isDestructive = button.style === 'destructive';

                  return (
                    <Button
                      key={index}
                      title={button.text}
                      onPress={() => handleButtonPress(button)}
                      variant={isCancel ? 'outline' : 'primary'}
                      fullWidth
                      style={
                        isDestructive
                          ? { backgroundColor: colors.primary }
                          : undefined
                      }
                    />
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  container: {
    width: Math.min(SCREEN_WIDTH - SPACING.lg * 2, LAYOUT.modalMaxWidth),
    borderRadius: LAYOUT.modalBorderRadius,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    zIndex: 1,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  message: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.lg,
  },
  buttonsContainer: {
    flexDirection: 'column',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.sm,
  },
});
