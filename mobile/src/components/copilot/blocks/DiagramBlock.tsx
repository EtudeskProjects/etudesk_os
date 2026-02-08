/**
 * DiagramBlock Component
 * Renders Mermaid diagrams via WebView + mermaid.js CDN
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { FileCode } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, ICON } from '../../../constants/theme';

interface DiagramBlockProps {
  data: {
    type: string;
    title: string;
    code: string;
  };
}

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 500;

const buildMermaidHTML = (code: string, isDark: boolean) => {
  const bg = isDark ? '#1a1a1a' : '#ffffff';
  const theme = isDark ? 'dark' : 'default';
  // Escape backticks and backslashes in the mermaid code for safe JS embedding
  const safeCode = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/<\/script/gi, '<\\/script');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=3,user-scalable=yes">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${bg}; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 12px; overflow: auto; }
    #diagram { width: 100%; display: flex; justify-content: center; }
    #diagram svg { max-width: 100%; height: auto; }
    #error { color: #ef4444; font-family: system-ui; font-size: 13px; padding: 16px; text-align: center; display: none; }
  </style>
</head>
<body>
  <div id="diagram"></div>
  <div id="error"></div>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: false, theme: '${theme}', securityLevel: 'loose' });
    (async () => {
      try {
        const { svg } = await mermaid.render('mmd', \`${safeCode}\`);
        document.getElementById('diagram').innerHTML = svg;
        // Send rendered height to React Native
        setTimeout(() => {
          const h = document.body.scrollHeight;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
        }, 100);
      } catch (e) {
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = 'Erreur de rendu: ' + e.message;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: 120 }));
      }
    })();
  </script>
</body>
</html>`;
};

export const DiagramBlock: React.FC<DiagramBlockProps> = ({ data }) => {
  const { colors, isDark } = useTheme();
  const [webViewHeight, setWebViewHeight] = useState(MIN_HEIGHT);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'height') {
        const h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, msg.value + 24));
        setWebViewHeight(h);
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <FileCode size={ICON.size.md} color={colors.primary} strokeWidth={ICON.strokeWidth} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {data.title}
          </Text>
          <Text style={[styles.type, { color: colors.textTertiary }]}>
            Diagramme {data.type}
          </Text>
        </View>
      </View>

      {/* Mermaid Render */}
      <View style={[styles.webviewContainer, { height: webViewHeight, backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }]}>
        <WebView
          source={{ html: buildMermaidHTML(data.code, isDark), baseUrl: 'https://cdn.jsdelivr.net' }}
          style={styles.webview}
          scrollEnabled
          nestedScrollEnabled
          javaScriptEnabled
          onMessage={onMessage}
          originWhitelist={['*']}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        />
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
  webviewContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default DiagramBlock;
