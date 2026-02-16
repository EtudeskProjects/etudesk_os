/**
 * MathBlock — Renders LaTeX math expressions via KaTeX in a WebView
 * Pattern: same as DiagramBlock (WebView + CDN + postMessage height)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY } from '../../../constants/theme';

interface MathBlockProps {
  data: {
    expression: string;
    displayMode?: boolean;
    caption?: string;
  };
}

const MIN_HEIGHT = 60;
const MAX_HEIGHT = 300;

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
      padding: 12px 16px;
      overflow: hidden;
    }
    #math { color: ${textColor}; width: 100%; text-align: center; }
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

  const displayMode = data.displayMode !== false;

  const html = useMemo(
    () =>
      buildKaTeXHTML(data.expression, {
        backgroundColor: colors.surface,
        textColor: colors.textPrimary,
        displayMode,
      }),
    [data.expression, colors.surface, colors.textPrimary, displayMode]
  );

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'height') {
        setWebViewHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, msg.value + 16)));
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.webviewContainer, { height: webViewHeight }]}>
        <WebView
          source={{
            html,
            baseUrl: 'https://cdn.jsdelivr.net',
          }}
          style={styles.webview}
          scrollEnabled={false}
          javaScriptEnabled
          onMessage={onMessage}
          originWhitelist={['*']}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        />
      </View>
      {data.caption ? (
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          {data.caption}
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
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  caption: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
});

export default MathBlock;
