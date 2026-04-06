/**
 * DiagramBlock Component
 * Renders Mermaid diagrams via WebView + mermaid.js CDN
 * Uses custom Etudesk theme (earth tones, warm browns, Satoshi font)
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../../../hooks/useTheme';
import { SPACING, TYPOGRAPHY } from '../../../constants/theme';
import i18n from '../../../i18n';
import { getLabelDirect } from '../../../utils/labels';

interface DiagramBlockProps {
  data: {
    type?: string;
    title?: string;
    code?: string;
    mermaidCode?: string;
    content?: string;
  };
}

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 600;

function sanitizeText(value: unknown, max = 120): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || ['null', 'undefined', '[object Object]'].includes(text)) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Resolve mermaid code from multiple possible keys */
function resolveCode(data: DiagramBlockProps['data']): string {
  const raw = data.code || data.mermaidCode || data.content || '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Sanitize Mermaid code to fix common LLM generation issues */
function sanitizeMermaidCode(code: string): string {
  let s = code.trim();
  s = s.replace(/^```(?:mermaid|diagram)?\s*/i, '').replace(/```$/, '').trim();
  // Convert literal \n (two chars: backslash + n) → <br> for Mermaid line breaks in labels
  // Mermaid uses <br> tags (not \n) for line breaks when securityLevel is 'loose'
  s = s.replace(/\\n/g, '<br>');
  // Escape parentheses inside square bracket labels []
  s = s.replace(/\[([^\]]*)\]/g, (_, content: string) => {
    const fixed = content.replace(/\(/g, '&#40;').replace(/\)/g, '&#41;');
    return `[${fixed}]`;
  });
  return s;
}

/**
 * Etudesk Mermaid theme variables
 * Earth tones: rich brown, forest green, warm amber, terracotta, olive
 */
const MERMAID_THEME_LIGHT = {
  primaryColor: '#F7F4F0',
  primaryTextColor: '#1F1C18',
  primaryBorderColor: '#D9D5CF',
  secondaryColor: '#E8EFE6',
  secondaryTextColor: '#1F1C18',
  secondaryBorderColor: '#C4D4B8',
  tertiaryColor: '#F7F0E8',
  tertiaryTextColor: '#1F1C18',
  tertiaryBorderColor: '#D6CBBC',
  lineColor: '#8B7355',
  textColor: '#1F1C18',
  mainBkg: '#F7F4F0',
  nodeBorder: '#D9D5CF',
  clusterBkg: '#FAF9F7',
  clusterBorder: '#EBE8E4',
  titleColor: '#3B2416',
  edgeLabelBackground: '#FFFFFF',
  nodeTextColor: '#1F1C18',
  // Flowchart specifics
  fillType0: '#F7F4F0',
  fillType1: '#E8EFE6',
  fillType2: '#F7F0E8',
  fillType3: '#F5EBE8',
  fillType4: '#F2EFEC',
  fillType5: '#F2F5F0',
  fillType6: '#F5F4F2',
  // Sequence diagram
  actorBkg: '#F7F4F0',
  actorBorder: '#3B2416',
  actorTextColor: '#1F1C18',
  actorLineColor: '#8B7355',
  signalColor: '#1F1C18',
  signalTextColor: '#1F1C18',
  labelBoxBkgColor: '#FAF9F7',
  labelBoxBorderColor: '#D9D5CF',
  labelTextColor: '#1F1C18',
  loopTextColor: '#6E675C',
  activationBorderColor: '#3B2416',
  activationBkgColor: '#EBE8E4',
  sequenceNumberColor: '#FFFFFF',
  // Gantt
  sectionBkgColor: '#F7F4F0',
  altSectionBkgColor: '#FAF9F7',
  gridColor: '#EBE8E4',
  todayLineColor: '#8B4A3C',
  taskBkgColor: '#3B2416',
  taskTextColor: '#FFFFFF',
  taskTextLightColor: '#FFFFFF',
  taskBorderColor: '#2A1A10',
  activeTaskBkgColor: '#5C3D2E',
  activeTaskBorderColor: '#3B2416',
  doneTaskBkgColor: '#4A6741',
  doneTaskBorderColor: '#3A5233',
  critBkgColor: '#8B4A3C',
  critBorderColor: '#6B3A2E',
  // Pie
  pie1: '#3B2416',
  pie2: '#4A6741',
  pie3: '#A67C52',
  pie4: '#8B4A3C',
  pie5: '#5E6B52',
  pie6: '#6B525E',
  pie7: '#52656B',
  pieStrokeColor: '#FFFFFF',
  pieTitleTextColor: '#1F1C18',
  pieSectionTextColor: '#FFFFFF',
  pieStrokeWidth: '1px',
  pieLegendTextColor: '#1F1C18',
  pieLegendTextSize: '12px',
};

const MERMAID_THEME_DARK = {
  primaryColor: '#2A2826',
  primaryTextColor: '#F5F3F0',
  primaryBorderColor: '#3D3A36',
  secondaryColor: '#1A2418',
  secondaryTextColor: '#F5F3F0',
  secondaryBorderColor: '#2A3428',
  tertiaryColor: '#2A2418',
  tertiaryTextColor: '#F5F3F0',
  tertiaryBorderColor: '#3A3428',
  lineColor: '#C9A070',
  textColor: '#F5F3F0',
  mainBkg: '#2A2826',
  nodeBorder: '#3D3A36',
  clusterBkg: '#1E1C1A',
  clusterBorder: '#3D3A36',
  titleColor: '#C9A070',
  edgeLabelBackground: '#1E1C1A',
  nodeTextColor: '#F5F3F0',
  fillType0: '#2A2826',
  fillType1: '#1A2418',
  fillType2: '#2A2418',
  fillType3: '#2A1816',
  fillType4: '#1E1C1A',
  fillType5: '#1A1C18',
  fillType6: '#1C1A18',
  // Sequence diagram
  actorBkg: '#2A2826',
  actorBorder: '#C9A070',
  actorTextColor: '#F5F3F0',
  actorLineColor: '#C9A070',
  signalColor: '#F5F3F0',
  signalTextColor: '#F5F3F0',
  labelBoxBkgColor: '#1E1C1A',
  labelBoxBorderColor: '#3D3A36',
  labelTextColor: '#F5F3F0',
  loopTextColor: '#B8B2A8',
  activationBorderColor: '#C9A070',
  activationBkgColor: '#3D3A36',
  sequenceNumberColor: '#0D0B0A',
  // Gantt
  sectionBkgColor: '#2A2826',
  altSectionBkgColor: '#1E1C1A',
  gridColor: '#3D3A36',
  todayLineColor: '#E08070',
  taskBkgColor: '#C9A070',
  taskTextColor: '#0D0B0A',
  taskTextLightColor: '#0D0B0A',
  taskBorderColor: '#A68050',
  activeTaskBkgColor: '#DDB88A',
  activeTaskBorderColor: '#C9A070',
  doneTaskBkgColor: '#7CB870',
  doneTaskBorderColor: '#5CA050',
  critBkgColor: '#E08070',
  critBorderColor: '#C86050',
  // Pie
  pie1: '#C9A070',
  pie2: '#7CB870',
  pie3: '#E8B870',
  pie4: '#E08070',
  pie5: '#A8C898',
  pie6: '#C8A0B0',
  pie7: '#90B8C0',
  pieStrokeColor: '#1E1C1A',
  pieTitleTextColor: '#F5F3F0',
  pieSectionTextColor: '#0D0B0A',
  pieStrokeWidth: '1px',
  pieLegendTextColor: '#F5F3F0',
  pieLegendTextSize: '12px',
};

const buildMermaidHTML = (
  code: string,
  opts: { backgroundColor: string; isDark: boolean; errorColor: string; textColor: string; renderErrorLabel: string }
) => {
  const { backgroundColor: bg, isDark, errorColor, textColor, renderErrorLabel } = opts;
  const themeVars = isDark ? MERMAID_THEME_DARK : MERMAID_THEME_LIGHT;
  const themeVarsJson = JSON.stringify(themeVars);
  // Only escape backticks and </script> — do NOT double-escape backslashes
  // as sanitizeMermaidCode already normalizes \n to real newlines
  const safeCode = code.replace(/`/g, '\\`').replace(/<\/script/gi, '<\\/script');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=3,user-scalable=yes">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: ${bg};
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px 12px;
      overflow: auto;
      font-family: 'DM Sans', system-ui, sans-serif;
    }
    #diagram { width: 100%; display: flex; justify-content: center; }
    #diagram svg { max-width: 100%; height: auto; }
    /* Override Mermaid default fonts */
    #diagram text, #diagram .nodeLabel, #diagram .edgeLabel,
    #diagram .label, #diagram .actor, #diagram .taskText {
      font-family: 'DM Sans', system-ui, sans-serif !important;
    }
    /* Soften node shapes */
    #diagram .node rect, #diagram .node polygon, #diagram .node circle {
      rx: 8;
      ry: 8;
    }
    #diagram .cluster rect {
      rx: 12;
      ry: 12;
    }
    /* Edge labels */
    #diagram .edgeLabel {
      font-size: 12px;
    }
    #error {
      color: ${errorColor};
      font-family: 'DM Sans', system-ui, sans-serif;
      font-size: 13px;
      padding: 16px;
      text-align: center;
      display: none;
    }
  </style>
</head>
<body>
  <div id="diagram"></div>
  <div id="error"></div>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: ${themeVarsJson},
      flowchart: { curve: 'basis', padding: 16, nodeSpacing: 30, rankSpacing: 40 },
      sequence: { mirrorActors: false, messageMargin: 30, boxMargin: 8 },
      gantt: { fontSize: 12, barHeight: 24, barGap: 6 },
      securityLevel: 'loose',
      fontFamily: '"DM Sans", system-ui, sans-serif',
    });
    (async () => {
      try {
        const { svg } = await mermaid.render('mmd', \`${safeCode}\`);
        document.getElementById('diagram').innerHTML = svg;
        setTimeout(() => {
          const h = document.body.scrollHeight;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
        }, 150);
      } catch (e) {
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = '${renderErrorLabel}' + e.message;
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
  const code = sanitizeMermaidCode(resolveCode(data));
  const title = sanitizeText(data.title, 72);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'height') {
        const h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, msg.value + 24));
        setWebViewHeight(h);
      }
    } catch { /* ignore */ }
  }, []);

  if (!code || code.length < 4) {
    return (
      <View style={styles.container}>
        {title ? <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text> : null}
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{getLabelDirect('noData')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title ? (
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {title}
        </Text>
      ) : null}

      <View style={[styles.webviewContainer, { height: webViewHeight }]}>
        <WebView
          source={{
            html: buildMermaidHTML(sanitizeMermaidCode(code), {
              backgroundColor: colors.surface,
              isDark,
              errorColor: colors.error,
              textColor: colors.textPrimary,
              renderErrorLabel: i18n.t('common.renderError'),
            }),
            baseUrl: 'https://cdn.jsdelivr.net',
          }}
          style={styles.webview}
          scrollEnabled={webViewHeight >= MAX_HEIGHT}
          nestedScrollEnabled={webViewHeight >= MAX_HEIGHT}
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
    marginVertical: SPACING.xs,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
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
});

export default DiagramBlock;
