import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SPACING, TYPOGRAPHY, BORDER } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';
import { Input } from './Input';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface PromptModalOptions {
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  multiline?: boolean;
  keyboardType?: React.ComponentProps<typeof Input>['keyboardType'];
}

interface PromptModalProps extends PromptModalOptions {
  visible: boolean;
  title: string;
  message?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export function PromptModal({
  visible,
  title,
  message,
  placeholder,
  defaultValue,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  multiline = false,
  keyboardType,
  onCancel,
  onConfirm,
}: PromptModalProps) {
  const { colors } = useTheme();
  const [value, setValue] = useState(defaultValue || '');

  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const scaleAnim = useMemo(() => new Animated.Value(0.96), []);

  useEffect(() => {
    if (visible) {
      setValue(defaultValue || '');
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 9, tension: 110, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.96, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, defaultValue, fadeAnim, scaleAnim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <Animated.View style={[styles.overlay, { backgroundColor: colors.overlay, opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <Animated.View
                style={[
                  styles.container,
                  { backgroundColor: colors.surface, borderColor: colors.borderColor, transform: [{ scale: scaleAnim }] },
                ]}
              >
                <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                {message ? (
                  <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
                ) : null}

                <Input
                  placeholder={placeholder}
                  value={value}
                  onChangeText={setValue}
                  multiline={multiline}
                  keyboardType={keyboardType}
                  autoFocus
                />

                <View style={styles.buttons}>
                  <Button
                    title={cancelText}
                    onPress={onCancel}
                    variant="secondary"
                    fullWidth
                  />
                  <Button
                    title={confirmText}
                    onPress={() => onConfirm(value)}
                    variant="primary"
                    fullWidth
                  />
                </View>
              </Animated.View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  container: {
    width: Math.min(SCREEN_WIDTH - SPACING.lg * 2, 420),
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.lg,
    padding: SPACING.lg,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  message: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.relaxed,
  },
  buttons: {
    flexDirection: 'column',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
});

