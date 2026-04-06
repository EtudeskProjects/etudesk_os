/**
 * CodeBlock Component
 * Displays code with syntax highlighting, language badge, and copy functionality
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Code, Copy, Check } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useI18n } from '../../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';
import { getLabelDirect } from '../../../utils/labels';


const MONO_FONT_FAMILY = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

interface CodeBlockProps {
  language: string;
  code: string;
}

function sanitizeText(value: unknown, max = 32): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function sanitizeCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\r\n?/g, '\n').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const safeCode = sanitizeCode(code);
  const safeLanguage = sanitizeText(language, 24) || 'code';

  const handleCopy = async () => {
    if (!safeCode) return;
    await Clipboard.setStringAsync(safeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLanguageLabel = (lang: string) => {
    const languageMap: Record<string, string> = {
      js: 'JavaScript',
      javascript: 'JavaScript',
      ts: 'TypeScript',
      typescript: 'TypeScript',
      jsx: 'React',
      tsx: 'React TypeScript',
      py: 'Python',
      python: 'Python',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      cs: 'C#',
      php: 'PHP',
      rb: 'Ruby',
      ruby: 'Ruby',
      go: 'Go',
      rust: 'Rust',
      swift: 'Swift',
      kotlin: 'Kotlin',
      dart: 'Dart',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      json: 'JSON',
      xml: 'XML',
      yaml: 'YAML',
      sql: 'SQL',
      bash: 'Bash',
      sh: 'Shell',
      md: 'Markdown',
      markdown: 'Markdown',
    };

    return languageMap[lang.toLowerCase()] || lang.toUpperCase();
  };

  if (!safeCode) {
    return (
      <View style={[styles.container, { backgroundColor: colors.gray900, borderColor: colors.borderColor }]}>
        <Text style={[styles.emptyText, { color: colors.gray400 }]}>{getLabelDirect('noData')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.gray900, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.gray800, borderBottomColor: withOpacity(colors.gray100, OPACITY[10]) }]}>
        <View style={styles.headerLeft}>
          <Code
            size={ICON.size.sm}
            color={colors.gray400}
            strokeWidth={ICON.strokeWidth}
          />
          <View style={[styles.languageBadge, { backgroundColor: withOpacity(colors.primary, OPACITY[30]) }]}>
            <Text style={[styles.languageText, { color: colors.primary }]}>
              {getLanguageLabel(safeLanguage)}
            </Text>
          </View>
        </View>

        {/* Copy Button */}
        <Pressable
          style={styles.copyButton}
          onPress={handleCopy}
                accessibilityRole="button"
                accessibilityLabel={t('codeBlock.copyCode')}
              >
          {copied ? (
            <>
              <Check
                size={ICON.size.sm}
                color={colors.success}
                strokeWidth={ICON.strokeWidth}
              />
              <Text style={[styles.copyButtonText, { color: colors.success }]}>
                {t('codeBlock.copied')}
              </Text>
            </>
          ) : (
            <>
              <Copy
                size={ICON.size.sm}
                color={colors.gray400}
                strokeWidth={ICON.strokeWidth}
              />
              <Text style={[styles.copyButtonText, { color: colors.gray400 }]}>
                {t('codeBlock.copy')}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Code Content */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.codeScrollView}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.codeVerticalScrollView}
        >
          <View style={styles.codeContainer}>
            {safeCode.split('\n').map((line, index) => (
              <View key={index} style={styles.codeLine}>
                <Text style={[styles.lineNumber, { color: colors.gray600 }]}>
                  {String(index + 1).padStart(2, ' ')}
                </Text>
                <Text style={[styles.codeText, { color: colors.gray100 }]}>
                  {line || ' '}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
    borderBottomColor: 'transparent',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  languageBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: BORDER.radius.xs,
  },
  languageText: {
    fontFamily: MONO_FONT_FAMILY,
    fontSize: TYPOGRAPHY.fontSize.xxs,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wider,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  copyButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  codeScrollView: {
    maxHeight: 400,
  },
  codeVerticalScrollView: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  codeContainer: {
    gap: 2,
  },
  codeLine: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  lineNumber: {
    fontFamily: MONO_FONT_FAMILY,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.6,
    width: 24,
    textAlign: 'right',
  },
  codeText: {
    fontFamily: MONO_FONT_FAMILY,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.6,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    padding: SPACING.md,
  },
});

export default CodeBlock;
