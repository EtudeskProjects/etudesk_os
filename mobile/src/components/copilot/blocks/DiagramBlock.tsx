/**
 * DiagramBlock Component
 * Displays Mermaid diagram code in a styled code block
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { FileCode } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';

interface DiagramBlockProps {
  data: {
    type: string;
    title: string;
    code: string;
  };
}

export const DiagramBlock: React.FC<DiagramBlockProps> = ({ data }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <FileCode
          size={ICON.size.md}
          color={colors.primary}
          strokeWidth={ICON.strokeWidth}
        />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {data.title}
          </Text>
          <Text style={[styles.type, { color: colors.textTertiary }]}>
            Diagramme {data.type}
          </Text>
        </View>
      </View>

      {/* Code Block */}
      <View style={[styles.codeContainer, { backgroundColor: colors.gray900, borderColor: colors.borderColor }]}>
        <View style={[styles.codeHeader, { backgroundColor: colors.gray800, borderBottomColor: withOpacity(colors.gray100, OPACITY[10]) }]}>
          <Text style={[styles.codeLanguage, { color: colors.gray400 }]}>
            mermaid
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.codeScrollView}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.codeVerticalScrollView}
          >
            <Text style={[styles.code, { color: colors.gray100 }]}>
              {data.code}
            </Text>
          </ScrollView>
        </ScrollView>
      </View>

      {/* Info */}
      <View style={[styles.info, { backgroundColor: colors.infoLight }]}>
        <Text style={[styles.infoText, { color: colors.info }]}>
          Les diagrammes Mermaid ne peuvent pas être rendus dans l'application mobile.
          Copiez le code ci-dessus pour le visualiser dans un éditeur compatible.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    overflow: 'hidden',
    marginVertical: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    marginBottom: SPACING.xxs,
  },
  type: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  codeContainer: {
    borderTopWidth: BORDER.width.thin,
    borderBottomWidth: BORDER.width.thin,
  },
  codeHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
    borderBottomColor: 'transparent',
  },
  codeLanguage: {
    fontFamily: 'Courier',
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wider,
  },
  codeScrollView: {
    maxHeight: 300,
  },
  codeVerticalScrollView: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  code: {
    fontFamily: 'Courier',
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.6,
  },
  info: {
    padding: SPACING.md,
  },
  infoText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: TYPOGRAPHY.fontSize.xs * TYPOGRAPHY.lineHeight.normal,
  },
});

export default DiagramBlock;
