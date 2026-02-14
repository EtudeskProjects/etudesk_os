import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { SPACING, TYPOGRAPHY, BORDER } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface FormTextAreaProps extends Omit<TextInputProps, 'multiline'> {
  label?: string;
  error?: string;
  hint?: string;
  maxLength?: number;
  rows?: number;
  /** When label is omitted, set this to true to show the character counter row. */
  showCounter?: boolean;
  containerStyle?: ViewStyle;
}

export function FormTextArea({
  label,
  error,
  hint,
  maxLength,
  rows = 4,
  showCounter,
  containerStyle,
  value,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  ...props
}: FormTextAreaProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const minHeight = rows * 24;
  const currentLen = (value?.toString() || '').length;
  const shouldShowCounter = !!maxLength && (showCounter ?? !!label);
  const shouldShowHeader = !!label || shouldShowCounter;

  return (
    <View style={[styles.container, containerStyle]}>
      {shouldShowHeader ? (
        <View style={styles.labelRow}>
          {label ? (
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {label}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {shouldShowCounter ? (
            <Text style={[styles.charCount, { color: colors.gray500 }]}>
              {currentLen}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.gray100,
            borderColor: colors.borderColor,
            minHeight,
          },
          isFocused && {
            borderColor: colors.primary,
            backgroundColor: colors.surface,
          },
          error && { borderColor: colors.error },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.textPrimary, minHeight: minHeight - 24 }]}
          placeholderTextColor={colors.gray500}
          onFocus={(e) => {
            setIsFocused(true);
            onFocusProp?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlurProp?.(e);
          }}
          multiline
          textAlignVertical="top"
          maxLength={maxLength}
          value={value}
          {...props}
        />
      </View>

      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
      {hint && !error && <Text style={[styles.hint, { color: colors.gray500 }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },

  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    flex: 1,
  },

  charCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  inputContainer: {
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
    padding: SPACING.md,
  },

  input: {
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: 24,
  },

  error: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },

  hint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },
});
