/**
 * DiagramBlock Component
 * Renders Mermaid diagrams via WebView + mermaid.js CDN
 * Uses custom Etudesk theme (earth tones, warm browns, Montserrat font)
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
 * Monochrome canvas (échelle zinc) + palette catégorielle (bleu/cyan/rose/
 * violet/émeraude/ambre/graphite) pour les segments — aucun ton brun.
 */
const MERMAID_THEME_LIGHT = {
  primaryColor: '#F4F4F5',
  primaryTextColor: '#18181B',
  primaryBorderColor: '#D4D4D8',
  secondaryColor: '#E4E4E7',
  secondaryTextColor: '#18181B',
  secondaryBorderColor: '#D4D4D8',
  tertiaryColor: '#FAFAFA',
  tertiaryTextColor: '#18181B',
  tertiaryBorderColor: '#E4E4E7',
  lineColor: '#71717A',
  textColor: '#18181B',
  mainBkg: '#F4F4F5',
  nodeBorder: '#D4D4D8',
  clusterBkg: '#FAFAFA',
  clusterBorder: '#E4E4E7',
  titleColor: '#18181B',
  edgeLabelBackground: '#FFFFFF',
  nodeTextColor: '#18181B',
  // Flowchart specifics
  fillType0: '#F4F4F5',
  fillType1: '#EAF1FE',
  fillType2: '#E4F5F9',
  fillType3: '#FCE9F1',
  fillType4: '#F1EAFD',
  fillType5: '#E3F4ED',
  fillType6: '#FEF3C7',
  // Sequence diagram
  actorBkg: '#F4F4F5',
  actorBorder: '#18181B',
  actorTextColor: '#18181B',
  actorLineColor: '#71717A',
  signalColor: '#18181B',
  signalTextColor: '#18181B',
  labelBoxBkgColor: '#FAFAFA',
  labelBoxBorderColor: '#D4D4D8',
  labelTextColor: '#18181B',
  loopTextColor: '#52525B',
  activationBorderColor: '#18181B',
  activationBkgColor: '#E4E4E7',
  sequenceNumberColor: '#FFFFFF',
  // Gantt
  sectionBkgColor: '#F4F4F5',
  altSectionBkgColor: '#FAFAFA',
  gridColor: '#E4E4E7',
  todayLineColor: '#DC2626',
  taskBkgColor: '#1D4ED8',
  taskTextColor: '#FFFFFF',
  taskTextLightColor: '#FFFFFF',
  taskBorderColor: '#1E3A8A',
  activeTaskBkgColor: '#6D28D9',
  activeTaskBorderColor: '#5B21B6',
  doneTaskBkgColor: '#16A34A',
  doneTaskBorderColor: '#15803D',
  critBkgColor: '#DC2626',
  critBorderColor: '#B91C1C',
  // Pie
  pie1: '#1D4ED8',
  pie2: '#0E7490',
  pie3: '#BE185D',
  pie4: '#6D28D9',
  pie5: '#047857',
  pie6: '#D97706',
  pie7: '#52525B',
  pieStrokeColor: '#FFFFFF',
  pieTitleTextColor: '#18181B',
  pieSectionTextColor: '#FFFFFF',
  pieStrokeWidth: '1px',
  pieLegendTextColor: '#18181B',
  pieLegendTextSize: '12px',
};

const MERMAID_THEME_DARK = {
  primaryColor: '#27272A',
  primaryTextColor: '#FAFAFA',
  primaryBorderColor: '#3F3F46',
  secondaryColor: '#18181B',
  secondaryTextColor: '#FAFAFA',
  secondaryBorderColor: '#3F3F46',
  tertiaryColor: '#18181B',
  tertiaryTextColor: '#FAFAFA',
  tertiaryBorderColor: '#3F3F46',
  lineColor: '#A1A1AA',
  textColor: '#FAFAFA',
  mainBkg: '#27272A',
  nodeBorder: '#3F3F46',
  clusterBkg: '#18181B',
  clusterBorder: '#3F3F46',
  titleColor: '#FAFAFA',
  edgeLabelBackground: '#18181B',
  nodeTextColor: '#FAFAFA',
  fillType0: '#27272A',
  fillType1: '#11233F',
  fillType2: '#0C2A30',
  fillType3: '#311321',
  fillType4: '#221A38',
  fillType5: '#0E2A20',
  fillType6: '#271E0E',
  // Sequence diagram
  actorBkg: '#27272A',
  actorBorder: '#FAFAFA',
  actorTextColor: '#FAFAFA',
  actorLineColor: '#A1A1AA',
  signalColor: '#FAFAFA',
  signalTextColor: '#FAFAFA',
  labelBoxBkgColor: '#18181B',
  labelBoxBorderColor: '#3F3F46',
  labelTextColor: '#FAFAFA',
  loopTextColor: '#A1A1AA',
  activationBorderColor: '#FAFAFA',
  activationBkgColor: '#3F3F46',
  sequenceNumberColor: '#09090B',
  // Gantt
  sectionBkgColor: '#27272A',
  altSectionBkgColor: '#18181B',
  gridColor: '#3F3F46',
  todayLineColor: '#F87171',
  taskBkgColor: '#60A5FA',
  taskTextColor: '#09090B',
  taskTextLightColor: '#09090B',
  taskBorderColor: '#3B82F6',
  activeTaskBkgColor: '#A78BFA',
  activeTaskBorderColor: '#8B5CF6',
  doneTaskBkgColor: '#34D399',
  doneTaskBorderColor: '#22C55E',
  critBkgColor: '#F87171',
  critBorderColor: '#EF4444',
  // Pie
  pie1: '#60A5FA',
  pie2: '#22D3EE',
  pie3: '#F472B6',
  pie4: '#A78BFA',
  pie5: '#34D399',
  pie6: '#FBBF24',
  pie7: '#A1A1AA',
  pieStrokeColor: '#18181B',
  pieTitleTextColor: '#FAFAFA',
  pieSectionTextColor: '#09090B',
  pieStrokeWidth: '1px',
  pieLegendTextColor: '#FAFAFA',
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
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: ${bg};
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px 12px;
      overflow: auto;
      font-family: 'Montserrat', system-ui, sans-serif;
    }
    #diagram { width: 100%; display: flex; justify-content: center; }
    #diagram svg { max-width: 100%; height: auto; }
    /* Override Mermaid default fonts */
    #diagram text, #diagram .nodeLabel, #diagram .edgeLabel,
    #diagram .label, #diagram .actor, #diagram .taskText {
      font-family: 'Montserrat', system-ui, sans-serif !important;
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
      font-family: 'Montserrat', system-ui, sans-serif;
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
      fontFamily: '"Montserrat", system-ui, sans-serif',
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
