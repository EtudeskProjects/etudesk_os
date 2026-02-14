import React, { useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  TextInputProps,
  findNodeHandle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, LAYOUT, BORDER, ICON } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../contexts/I18nContext';
import { useScrollToInput } from '../../contexts/ScrollToInputContext';
import { Tap } from './Tap';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /** Accessibility label - defaults to label if not provided */
  accessibilityLabel?: string;
  /** Accessibility hint */
  accessibilityHint?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerStyle,
  inputContainerStyle,
  inputStyle,
  secureTextEntry,
  multiline,
  accessibilityLabel,
  accessibilityHint,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  ...props
}: InputProps, ref) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const scrollToInput = useScrollToInput();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isPassword = secureTextEntry !== undefined;
  const innerRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => innerRef.current as TextInput, []);

  const accessibilityHintResolved = useMemo(() => {
    if (accessibilityHint) return accessibilityHint;
    if (error) return t('input.errorHint', { error: error || '' });
    return hint;
  }, [accessibilityHint, error, hint, t]);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.gray100,
            borderColor: colors.borderColor,
          },
          multiline && { height: undefined, minHeight: 96, alignItems: 'flex-start' },
          isFocused && {
            borderColor: colors.primary,
            backgroundColor: colors.surface,
          },
          error && { borderColor: colors.error },
          inputContainerStyle,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          ref={innerRef}
          style={[
            styles.input,
            { color: colors.textPrimary },
            !!leftIcon && styles.inputWithLeftIcon,
            !!(rightIcon || isPassword) && styles.inputWithRightIcon,
            multiline && { height: undefined, paddingTop: SPACING.md, paddingBottom: SPACING.md, textAlignVertical: 'top' as const },
            inputStyle,
          ]}
          multiline={multiline}
          placeholderTextColor={colors.gray500}
          onFocus={(e) => {
            setIsFocused(true);
            const node = findNodeHandle(innerRef.current);
            if (node && scrollToInput) scrollToInput(node);
            onFocusProp?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlurProp?.(e);
          }}
          secureTextEntry={isPassword && !isPasswordVisible}
          accessible={true}
          accessibilityLabel={accessibilityLabel || label}
          accessibilityHint={accessibilityHintResolved}
          accessibilityState={{
            disabled: props.editable === false ? true : undefined,
          }}
          {...props}
        />

        {isPassword && (
          <Tap
            style={styles.iconRight}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? t('input.hidePassword') : t('input.showPassword')}
            accessibilityHint={t('input.togglePasswordHint')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            {isPasswordVisible ? (
              <EyeOff
                size={ICON.size.md}
                color={colors.gray500}
                strokeWidth={ICON.strokeWidth}
              />
            ) : (
              <Eye
                size={ICON.size.md}
                color={colors.gray500}
                strokeWidth={ICON.strokeWidth}
              />
            )}
          </Tap>
        )}

        {rightIcon && !isPassword && (
          <View style={styles.iconRight}>{rightIcon}</View>
        )}
      </View>

      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
      {hint && !error && <Text style={[styles.hint, { color: colors.gray500 }]}>{hint}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: LAYOUT.inputHeight,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },

  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
  },

  inputWithLeftIcon: {
    paddingLeft: SPACING.xs,
  },

  inputWithRightIcon: {
    paddingRight: SPACING.xs,
  },

  iconLeft: {
    paddingLeft: SPACING.md,
  },

  iconRight: {
    paddingRight: SPACING.md,
  },

  error: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },

  hint: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },
});
