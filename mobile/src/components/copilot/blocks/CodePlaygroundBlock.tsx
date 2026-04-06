/**
 * CodePlaygroundBlock — JavaScript code playground with sandboxed WebView execution
 * Editable code + Run button + console output + expected output validation
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Play, RotateCcw, CheckCircle2, XCircle } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useI18n } from '../../../contexts/I18nContext';
import { SPACING, TYPOGRAPHY, BORDER, ICON, OPACITY, withOpacity } from '../../../constants/theme';
import { getLabelDirect } from '../../../utils/labels';

const MONO_FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

interface CodePlaygroundBlockProps {
  data: {
    language?: string;
    title?: string;
    code: string;
    editable?: boolean;
    expectedOutput?: string;
  };
}

const RUNNABLE_LANGUAGES = new Set(['', 'js', 'javascript', 'mjs', 'node']);

function sanitizeText(value: unknown, max = 220): string | undefined {
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

function normalizeLanguage(value: unknown): string {
  return sanitizeText(value, 24)?.toLowerCase() || 'javascript';
}

function sanitizeOutput(value: unknown, max = 1200): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\r\n?/g, '\n').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Build sandboxed HTML that executes JS and captures console.log output */
function buildPlaygroundHTML(code: string, bgColor: string, textColor: string, timeoutMessage: string): string {
  const safeCode = code
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/<\/script/gi, '<\\/script');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${bgColor}; padding: 0; font-family: monospace; color: ${textColor}; }
  </style>
</head>
<body>
  <script>
    const logs = [];
    const origLog = console.log;
    console.log = function() {
      const args = Array.from(arguments).map(a => {
        if (typeof a === 'object') return JSON.stringify(a, null, 2);
        return String(a);
      });
      logs.push(args.join(' '));
    };
    console.error = function() {
      logs.push('[Error] ' + Array.from(arguments).join(' '));
    };
    console.warn = function() {
      logs.push('[Warn] ' + Array.from(arguments).join(' '));
    };

    let timeout;
    try {
      timeout = setTimeout(() => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'result',
          output: logs.join('\\n') + '\\n${timeoutMessage}',
          error: true,
        }));
      }, 5000);

      const result = (function() { ${safeCode} })();
      clearTimeout(timeout);

      if (result !== undefined && logs.length === 0) {
        logs.push(String(result));
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'result',
        output: logs.join('\\n'),
        error: false,
      }));
    } catch (e) {
      clearTimeout(timeout);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'result',
        output: logs.join('\\n') + (logs.length ? '\\n' : '') + '[Error] ' + e.message,
        error: true,
      }));
    }
  </script>
</body>
</html>`;
}

export const CodePlaygroundBlock: React.FC<CodePlaygroundBlockProps> = ({ data }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const initialCode = sanitizeCode(data.code) || '';
  const language = normalizeLanguage(data.language);
  const languageLabel = sanitizeText(data.language, 24) || 'javascript';
  const title = sanitizeText(data.title, 72);
  const expectedOutput = sanitizeText(data.expectedOutput, 220);
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const webViewRef = useRef<WebView>(null);

  const editable = data.editable !== false;
  const canRun = RUNNABLE_LANGUAGES.has(language);
  const hasExpected = Boolean(expectedOutput) && canRun;

  const outputMatches = useMemo(() => {
    if (!hasExpected || output === null) return null;
    return output.trim() === expectedOutput!.trim();
  }, [output, expectedOutput, hasExpected]);

  const handleRun = useCallback(() => {
    if (!canRun || !code) return;
    setIsRunning(true);
    setOutput(null);
    setRunKey((k) => k + 1);
  }, [canRun, code]);

  const handleReset = useCallback(() => {
    setCode(initialCode);
    setOutput(null);
    setHasError(false);
  }, [initialCode]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'result') {
        setOutput(sanitizeOutput(msg.output, 1200) || t('codePlayground.noOutput'));
        setHasError(Boolean(msg.error));
        setIsRunning(false);
      }
    } catch { /* ignore */ }
  }, [t]);

  const html = useMemo(
    () => buildPlaygroundHTML(code, colors.surface, colors.textPrimary, t('codePlayground.timeout')),
    // Only rebuild when runKey changes (user presses Run)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runKey]
  );

  if (!initialCode) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
        {title ? <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text> : null}
        <Text style={[styles.noteText, { color: colors.textSecondary }]}>{getLabelDirect('noData')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {title && title.toLowerCase() !== languageLabel.toLowerCase() ? (
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      ) : null}
      <Text style={[styles.langBadge, { color: colors.textSecondary }]}>
        {languageLabel}
      </Text>

      {!canRun ? (
        <Text style={[styles.noteText, { color: colors.textSecondary }]}>{t('codePlayground.jsOnly')}</Text>
      ) : null}

      <View style={[styles.codeContainer, { backgroundColor: colors.background, borderColor: colors.borderColor }]}>
        {editable ? (
          <TextInput
            style={[styles.codeInput, { color: colors.textPrimary }]}
            value={code}
            onChangeText={setCode}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textAlignVertical="top"
          />
        ) : (
          <Text style={[styles.codeText, { color: colors.textPrimary }]}>{code}</Text>
        )}
      </View>

      {canRun ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.runButton, { backgroundColor: colors.primary }]}
            onPress={handleRun}
            disabled={isRunning}
          >
            <Play size={ICON.size.sm} color={colors.white} />
            <Text style={[styles.runText, { color: colors.white }]}>
              {isRunning ? t('codePlayground.running') : t('codePlayground.run')}
            </Text>
          </Pressable>
          {editable && code !== initialCode && (
            <Pressable
              style={[styles.resetButton, { borderColor: colors.borderColor }]}
              onPress={handleReset}
            >
              <RotateCcw size={ICON.size.sm} color={colors.textSecondary} />
              <Text style={[styles.resetText, { color: colors.textSecondary }]}>{t('codePlayground.reset')}</Text>
            </Pressable>
          )}
        </View>
      ) : editable && code !== initialCode ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.resetButton, { borderColor: colors.borderColor }]}
            onPress={handleReset}
          >
            <RotateCcw size={ICON.size.sm} color={colors.textSecondary} />
            <Text style={[styles.resetText, { color: colors.textSecondary }]}>{t('codePlayground.reset')}</Text>
          </Pressable>
        </View>
      ) : null}

      {output !== null && canRun && (
        <View
          style={[
            styles.outputContainer,
            {
              backgroundColor: hasError
                ? withOpacity(colors.error, OPACITY[5])
                : withOpacity(colors.success, OPACITY[5]),
              borderColor: hasError
                ? withOpacity(colors.error, OPACITY[20])
                : withOpacity(colors.success, OPACITY[20]),
            },
          ]}
        >
          <Text style={[styles.outputLabel, { color: colors.textSecondary }]}>{t('codePlayground.console')}</Text>
          <Text style={[styles.outputText, { color: hasError ? colors.error : colors.textPrimary }]}>
            {output}
          </Text>
        </View>
      )}

      {hasExpected && outputMatches !== null && (
        <View style={[styles.validationRow, { borderColor: colors.borderColor }]}>
          {outputMatches ? (
            <>
              <CheckCircle2 size={ICON.size.sm} color={colors.success} />
              <Text style={[styles.validationText, { color: colors.success }]}>
                {t('codePlayground.expectedOutput')}{expectedOutput}
              </Text>
            </>
          ) : (
            <>
              <XCircle size={ICON.size.sm} color={colors.error} />
              <Text style={[styles.validationText, { color: colors.error }]}>
                {t('codePlayground.expected')}{expectedOutput}
              </Text>
            </>
          )}
        </View>
      )}

      {isRunning && canRun && (
        <WebView
          key={runKey}
          ref={webViewRef}
          source={{ html }}
          style={{ height: 0, width: 0, opacity: 0 }}
          javaScriptEnabled
          onMessage={onMessage}
          originWhitelist={['*']}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    marginBottom: SPACING.xs,
  },
  langBadge: {
    fontFamily: MONO_FONT,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noteText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: TYPOGRAPHY.fontSize.xs * TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.sm,
  },
  codeContainer: {
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    padding: SPACING.sm,
    minHeight: 80,
    marginBottom: SPACING.sm,
  },
  codeInput: {
    fontFamily: MONO_FONT,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.6,
    minHeight: 80,
  },
  codeText: {
    fontFamily: MONO_FONT,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.6,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER.radius.md,
  },
  runText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
  },
  resetText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  outputContainer: {
    borderRadius: BORDER.radius.md,
    borderWidth: BORDER.width.thin,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  outputLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  outputText: {
    fontFamily: MONO_FONT,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  validationText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default CodePlaygroundBlock;
