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
  const [code, setCode] = useState(data.code);
  const [output, setOutput] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const webViewRef = useRef<WebView>(null);

  const editable = data.editable !== false;
  const hasExpected = !!data.expectedOutput;

  const outputMatches = useMemo(() => {
    if (!hasExpected || output === null) return null;
    return output.trim() === data.expectedOutput!.trim();
  }, [output, data.expectedOutput, hasExpected]);

  const handleRun = useCallback(() => {
    setIsRunning(true);
    setOutput(null);
    setRunKey((k) => k + 1);
  }, []);

  const handleReset = useCallback(() => {
    setCode(data.code);
    setOutput(null);
    setHasError(false);
  }, [data.code]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'result') {
        setOutput(msg.output || t('codePlayground.noOutput'));
        setHasError(msg.error);
        setIsRunning(false);
      }
    } catch { /* ignore */ }
  }, []);

  const html = useMemo(
    () => buildPlaygroundHTML(code, colors.surface, colors.textPrimary, t('codePlayground.timeout')),
    // Only rebuild when runKey changes (user presses Run)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runKey]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      {data.title && (
        <Text style={[styles.title, { color: colors.textPrimary }]}>{data.title}</Text>
      )}
      <Text style={[styles.langBadge, { color: colors.textSecondary }]}>
        {data.language || 'javascript'}
      </Text>

      {/* Code editor */}
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

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.runButton, { backgroundColor: colors.primary }]}
          onPress={handleRun}
          disabled={isRunning}
        >
          <Play size={ICON.size.sm} color={colors.white} />
          <Text style={[styles.runText, { color: colors.white }]}>
            {isRunning ? t('codePlayground.running') : 'Run'}
          </Text>
        </Pressable>
        {editable && code !== data.code && (
          <Pressable
            style={[styles.resetButton, { borderColor: colors.borderColor }]}
            onPress={handleReset}
          >
            <RotateCcw size={ICON.size.sm} color={colors.textSecondary} />
            <Text style={[styles.resetText, { color: colors.textSecondary }]}>Reset</Text>
          </Pressable>
        )}
      </View>

      {/* Console output */}
      {output !== null && (
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
          <Text style={[styles.outputLabel, { color: colors.textSecondary }]}>Console</Text>
          <Text style={[styles.outputText, { color: hasError ? colors.error : colors.textPrimary }]}>
            {output}
          </Text>
        </View>
      )}

      {/* Expected output validation */}
      {hasExpected && outputMatches !== null && (
        <View style={[styles.validationRow, { borderColor: colors.borderColor }]}>
          {outputMatches ? (
            <>
              <CheckCircle2 size={ICON.size.sm} color={colors.success} />
              <Text style={[styles.validationText, { color: colors.success }]}>
                {t('codePlayground.expectedOutput')}{data.expectedOutput}
              </Text>
            </>
          ) : (
            <>
              <XCircle size={ICON.size.sm} color={colors.error} />
              <Text style={[styles.validationText, { color: colors.error }]}>
                {t('codePlayground.expected')}{data.expectedOutput}
              </Text>
            </>
          )}
        </View>
      )}

      {/* Hidden WebView for execution */}
      {isRunning && (
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
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.xs,
  },
  langBadge: {
    fontFamily: MONO_FONT,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
