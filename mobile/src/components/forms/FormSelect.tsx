import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ViewStyle,
} from 'react-native';
import { ChevronDown, Check, X } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, BORDER, ICON, LAYOUT, OPACITY, withOpacity } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

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
  placeholder = 'Sélectionner',
  options,
  value,
  onChange,
  error,
  containerStyle,
}: FormSelectProps) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(o => o.value === value);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}

      <TouchableOpacity
        style={[
          styles.selectButton,
          {
            backgroundColor: colors.gray100,
            borderColor: error ? colors.error : colors.borderColor,
          },
        ]}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.selectText,
            { color: selectedOption ? colors.textPrimary : colors.gray500 },
          ]}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <ChevronDown size={ICON.size.sm} color={colors.gray500} strokeWidth={ICON.strokeWidth} />
      </TouchableOpacity>

      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

      <Modal visible={isOpen} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {label || 'Sélectionner'}
              </Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <X size={ICON.size.md} color={colors.textPrimary} strokeWidth={ICON.strokeWidth} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    { borderBottomColor: colors.gray100 },
                    item.value === value && { backgroundColor: withOpacity(colors.primary, OPACITY[10]) },
                  ]}
                  onPress={() => {
                    onChange(item.value);
                    setIsOpen(false);
                  }}
                  activeOpacity={0.8}
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
                </TouchableOpacity>
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
