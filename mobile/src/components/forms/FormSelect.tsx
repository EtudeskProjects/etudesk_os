import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  ViewStyle,
  Pressable,
} from 'react-native';
import { ChevronDown, Check, X } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, ICON, LAYOUT, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../contexts/I18nContext';
import { IconButton } from '../ui';


interface SelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  containerStyle?: ViewStyle;
}

export function FormSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  error,
  containerStyle,
}: FormSelectProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(o => o.value === value);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}

      <Pressable
        style={[
          styles.selectButton,
          {
            backgroundColor: colors.gray100,
            borderColor: error ? colors.error : colors.borderColor,
          },
        ]}
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
      >
        <Text
          style={[
            styles.selectText,
            { color: selectedOption ? colors.textPrimary : colors.gray500 },
          ]}
        >
          {selectedOption?.label || placeholder || t('common.select')}
        </Text>
        <ChevronDown size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
      </Pressable>

      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

      <Modal visible={isOpen} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {label || t('common.select')}
              </Text>
              <IconButton
                onPress={() => setIsOpen(false)}
                icon={<X size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />}
                accessibilityLabel={t('common.close')}
                style={{ backgroundColor: 'transparent' }}
              />
            </View>

            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.optionItem,
                    { borderBottomColor: colors.gray100 },
                    item.value === value && { backgroundColor: withOpacity(colors.primary, OPACITY[10]) },
                  ]}
                  onPress={() => {
                    onChange(item.value);
                    setIsOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: colors.textPrimary },
                      item.value === value && { color: colors.primary },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Check size={ICON.size.sm} color={colors.primary} strokeWidth={ICON.strokeWidth} />
                  )}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    marginBottom: SPACING.xs,
  },

  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: LAYOUT.inputHeight,
    paddingHorizontal: SPACING.md,
    borderWidth: BORDER.width.thin,
    borderRadius: BORDER.radius.sm,
  },

  selectText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    flex: 1,
  },

  error: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: BORDER.radius.lg,
    borderTopRightRadius: BORDER.radius.lg,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: BORDER.width.thin,
  },

  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: BORDER.width.thin,
  },

  optionText: {
    fontSize: TYPOGRAPHY.fontSize.md,
  },
});
