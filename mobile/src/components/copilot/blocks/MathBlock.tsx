/**
 * MathBlock — Renders LaTeX math expressions via KaTeX in a WebView
 * Pattern: same as DiagramBlock (WebView + CDN + postMessage height)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY } from '../../../constants/theme';
import { getLabelDirect } from '../../../utils/labels';

interface MathBlockProps {
  data: {
    expression: string;
    displayMode?: boolean;
    caption?: string;
  };
}

const MIN_HEIGHT = 60;
const MAX_HEIGHT = 300;

function sanitizeText(value: unknown, max = 240): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function sanitizeExpression(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\r\n?/g, '\n').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text;
}

/** Build KaTeX HTML — reusable for inline math in other blocks */
export function buildKaTeXHTML(
  expression: string,
  opts: { backgroundColor: string; textColor: string; displayMode: boolean }
): string {
  const { backgroundColor, textColor, displayMode } = opts;
  const safeExpr = expression
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/<\/script/gi, '<\\/script');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=3,user-scalable=yes">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: ${backgroundColor};
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 40px;
      padding: 12px 8px;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }
    #math {
      color: ${textColor};
      width: 100%;
      text-align: center;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .katex-display { overflow-x: auto; overflow-y: hidden; padding-bottom: 4px; }
    .katex { white-space: nowrap; }
    #error {
      color: ${textColor};
      font-family: monospace;
      font-size: 13px;
      padding: 8px;
      text-align: center;
      display: none;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div id="math"></div>
  <div id="error"></div>
  <script>
    try {
      katex.render(\`${safeExpr}\`, document.getElementById('math'), {
        displayMode: ${displayMode},
        throwOnError: false,
        trust: true,
        strict: false,
      });
      setTimeout(() => {
        const h = document.body.scrollHeight;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
      }, 100);
    } catch (e) {
      document.getElementById('error').style.display = 'block';
      document.getElementById('error').textContent = \`${safeExpr}\`;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: 60 }));
    }
  </script>
</body>
</html>`;
}

export const MathBlock: React.FC<MathBlockProps> = ({ data }) => {
  const { colors } = useTheme();
  const [webViewHeight, setWebViewHeight] = useState(MIN_HEIGHT);
  const expression = sanitizeExpression(data.expression);
  const caption = sanitizeText(data.caption, 140);

  const displayMode = data.displayMode !== false;

  const html = useMemo(
    () =>
      buildKaTeXHTML(expression || '', {
        backgroundColor: colors.surface,
        textColor: colors.textPrimary,
        displayMode,
      }),
    [expression, colors.surface, colors.textPrimary, displayMode]
  );

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'height') {
        setWebViewHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, msg.value + 16)));
      }
    } catch { /* ignore */ }
  }, []);

  if (!expression) {
    return (
      <View style={styles.container}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{getLabelDirect('noData')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.webviewContainer, { height: webViewHeight }]}>
        <WebView
          source={{
            html,
            baseUrl: 'https://cdn.jsdelivr.net',
          }}
          style={styles.webview}
          scrollEnabled={webViewHeight >= MAX_HEIGHT}
          javaScriptEnabled
          onMessage={onMessage}
          originWhitelist={['*']}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={true}
        />
      </View>
      {caption && caption !== expression ? (
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.xs,
  },
  webviewContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'visible',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  caption: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export default MathBlock;
