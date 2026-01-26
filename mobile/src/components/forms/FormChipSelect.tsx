import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface ChipOption {
  value: string;
  label: string;
}

interface FormChipSelectProps {
  label?: string;
  options: ChipOption[];
  value: string[];
  onChange: (values: string[]) => void;
  error?: string;
  hint?: string;
  maxSelections?: number;
  containerStyle?: ViewStyle;
}

export function FormChipSelect({
  label,
  options,
  value,
  onChange,
  error,
  hint,
  maxSelections,
  containerStyle,
}: FormChipSelectProps) {
  const { colors } = useTheme();

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      if (maxSelections && value.length >= maxSelections) {
        return;
      }
      onChange([...value, optionValue]);
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
          {maxSelections && (
            <Text style={[styles.selectionCount, { color: colors.gray500 }]}>
              {value.length}/{maxSelections}
            </Text>
          )}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        {options.map((option) => {
          const isSelected = value.includes(option.value);
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.primary + '15' : colors.gray100,
                  borderColor: isSelected ? colors.primary : colors.borderColor,
                },
              ]}
              onPress={() => handleToggle(option.value)}
              activeOpacity={0.8}
            >
              {isSelected && (
                <Check size={14} color={colors.primary} strokeWidth={2} />
              )}
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? colors.primary : colors.textPrimary },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
    marginBottom: SPACING.sm,
  },

  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  selectionCount: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  chipsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.full,
  },

  chipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
