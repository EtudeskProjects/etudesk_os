/**
 * CodeBlock Component
 * Displays code with syntax highlighting, language badge, and copy functionality
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Code, Copy, Check } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../../constants/theme';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
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

  return (
    <View style={[styles.container, { backgroundColor: colors.gray900, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.gray800 }]}>
        <View style={styles.headerLeft}>
          <Code
            size={ICON.size.sm}
            color={colors.gray400}
            strokeWidth={ICON.strokeWidth}
          />
          <View style={[styles.languageBadge, { backgroundColor: colors.primary + '30' }]}>
            <Text style={[styles.languageText, { color: colors.primary }]}>
              {getLanguageLabel(language)}
            </Text>
          </View>
        </View>

        {/* Copy Button */}
        <TouchableOpacity
          style={styles.copyButton}
          onPress={handleCopy}
          activeOpacity={0.7}
        >
          {copied ? (
            <>
              <Check
                size={ICON.size.sm}
                color={colors.success}
                strokeWidth={ICON.strokeWidth}
              />
              <Text style={[styles.copyButtonText, { color: colors.success }]}>
                Copié
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
                Copier
              </Text>
            </>
          )}
        </TouchableOpacity>
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
            {code.split('\n').map((line, index) => (
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
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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
    fontFamily: 'Courier',
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
    fontFamily: 'Courier',
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.6,
    width: 24,
    textAlign: 'right',
  },
  codeText: {
    fontFamily: 'Courier',
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.6,
  },
});

export default CodeBlock;
