/**
 * MarkdownRenderer — Custom markdown parser for copilot messages
 * Detects special blocks (entity, quiz, flashcard, youtube, diagram, image, chart, code)
 * and renders them as interactive components.
 * Standard markdown: **bold**, _italic_, # headings, - lists, [links](url), > quotes
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER, OPACITY, withOpacity } from '../../constants/theme';
import { ShimmerPlaceholder } from '../ui/ShimmerPlaceholder';
import { EntityCard } from './EntityCard';
import { QuizBlock } from './blocks/QuizBlock';
import { FlashcardBlock } from './blocks/FlashcardBlock';
import { YouTubeBlock } from './blocks/YouTubeBlock';
import { DiagramBlock } from './blocks/DiagramBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { ChartBlock } from './blocks/ChartBlock';
import { CodeBlock } from './blocks/CodeBlock';
import { ConfirmationBlock } from './blocks/ConfirmationBlock';

const MONO_FONT_FAMILY = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

interface MarkdownRendererProps {
  content: string;
  onQuizAnswer?: (answer: string) => void;
  sessionId?: string;
  interactiveConfirmation?: boolean;
}

// Parse content into blocks
interface Block {
  type: 'text' | 'entity' | 'quiz' | 'flashcard' | 'youtube' | 'diagram' | 'image' | 'chart' | 'code' | 'confirmation' | 'loading';
  content: string;
  meta?: string; // entity type, language, etc.
  data?: any; // parsed JSON data
}

/**
 * Try to parse JSON with basic repair for common LLM issues:
 * - Trailing commas
 * - Unquoted values after colons
 * - Truncated strings
 */
function tryParseJSON(raw: string): any | null {
  // 1. Direct parse
  try { return JSON.parse(raw); } catch { /* continue */ }

  // 2. Try fixing common issues
  let fixed = raw
    .replace(/,\s*}/g, '}')       // trailing commas
    .replace(/,\s*]/g, ']')       // trailing commas in arrays
    .replace(/'/g, '"');           // single quotes → double quotes

  try { return JSON.parse(fixed); } catch { /* continue */ }

  // 3. Try to extract key-value pairs manually for entity-like objects
  const kvRegex = /"(\w+)"\s*:\s*("(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?|true|false|null|\[.*?\])/g;
  const obj: Record<string, any> = {};
  let m: RegExpExecArray | null;
  while ((m = kvRegex.exec(raw)) !== null) {
    try {
      obj[m[1]] = JSON.parse(m[2]);
    } catch {
      obj[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  }
  return Object.keys(obj).length > 0 ? obj : null;
}

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  // Match fenced code blocks: 2+ backticks (tolerant) + tag + newline + body + 2+ backticks
  const blockRegex = /`{2,}([\w:-]+)\n([\s\S]*?)`{2,}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(content)) !== null) {
    // Add text before this block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) blocks.push({ type: 'text', content: text });
    }

    const tag = match[1];
    const body = match[2].trim();

    // Known entity type names (used as fallback when LLM omits `entity:` prefix)
    const ENTITY_TYPES = ['opportunity', 'community', 'space', 'organization', 'talent', 'event', 'document', 'skill', 'notification', 'maps'];

    // Entity blocks: entity:opportunity, entity:community, OR just opportunity, community, etc.
    const isEntityTag = tag.startsWith('entity:') || ENTITY_TYPES.includes(tag);
    if (isEntityTag) {
      const entityType = tag.startsWith('entity:') ? tag.replace('entity:', '') : tag;
      const data = tryParseJSON(body);
      // Documents can use file_url as identifier instead of id
      const hasValidId = data && (data.id || (entityType === 'document' && (data.file_url || data.downloadUrl)));
      if (hasValidId) {
        blocks.push({ type: 'entity', content: body, meta: entityType, data });
      } else {
        // Malformed entity — skip silently (don't show raw JSON)
      }
    }
    // Quiz block
    else if (tag === 'quiz') {
      const data = tryParseJSON(body);
      if (data) blocks.push({ type: 'quiz', content: body, data });
    }
    // Flashcard block — require front + back fields
    else if (tag === 'flashcard') {
      const data = tryParseJSON(body);
      if (data && data.front && data.back) {
        blocks.push({ type: 'flashcard', content: body, data });
      }
      // Malformed flashcard (truncated/missing fields) — skip silently
    }
    // YouTube block
    else if (tag === 'youtube') {
      const data = tryParseJSON(body);
      if (data) blocks.push({ type: 'youtube', content: body, data });
    }
    // Diagram block
    else if (tag === 'diagram') {
      const data = tryParseJSON(body);
      if (data) blocks.push({ type: 'diagram', content: body, data });
    }
    // Image block
    else if (tag === 'image') {
      const data = tryParseJSON(body);
      if (data) blocks.push({ type: 'image', content: body, data });
    }
    // Chart block
    else if (tag === 'chart') {
      const data = tryParseJSON(body);
      if (data) blocks.push({ type: 'chart', content: body, data });
    }
    // Confirmation block
    else if (tag === 'confirmation') {
      const data = tryParseJSON(body);
      if (data && data.action && data.entity_id && data.title) {
        blocks.push({ type: 'confirmation', content: body, data });
      }
    }
    // Code blocks: code:javascript or just javascript, python, etc.
    else {
      const language = tag.replace('code:', '');
      blocks.push({ type: 'code', content: body, meta: language });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text — but detect unclosed code blocks (SSE streaming)
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    // Check for unclosed fenced code block: opening backticks+tag without closing backticks
    const unclosedMatch = remaining.match(/`{2,}([\w:-]+)\n[\s\S]*$/);
    if (unclosedMatch) {
      // Text before the unclosed block
      const textBefore = remaining.slice(0, unclosedMatch.index).trim();
      if (textBefore) blocks.push({ type: 'text', content: textBefore });
      // Show loading placeholder instead of raw JSON
      const tag = unclosedMatch[1];
      blocks.push({ type: 'loading', content: '', meta: tag });
    } else {
      const text = remaining.trim();
      if (text) blocks.push({ type: 'text', content: text });
    }
  }

  return blocks;
}

// Inline markdown rendering (bold, italic, links, inline code)
function renderInlineMarkdown(text: string, colors: any): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Regex: **bold**, *italic*/_italic_, `code`, [text](url)
  const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = inlineRegex.exec(text)) !== null) {
    // Text before match
    if (m.index > lastIdx) {
      parts.push(
        <Text key={key++} style={{ color: colors.textPrimary }}>
          {text.slice(lastIdx, m.index)}
        </Text>
      );
    }

    if (m[2]) {
      // **bold**
      parts.push(
        <Text key={key++} style={{ fontWeight: '700', color: colors.textPrimary }}>
          {m[2]}
        </Text>
      );
    } else if (m[3] || m[4]) {
      // *italic* or _italic_
      parts.push(
        <Text key={key++} style={{ fontStyle: 'italic', color: colors.textPrimary }}>
          {m[3] || m[4]}
        </Text>
      );
    } else if (m[5]) {
      // `code`
      parts.push(
        <Text
          key={key++}
          style={{
            fontFamily: MONO_FONT_FAMILY,
            backgroundColor: colors.surface,
            color: colors.primary,
            paddingHorizontal: 4,
            borderRadius: 3,
            fontSize: TYPOGRAPHY.fontSize.sm,
          }}
        >
          {m[5]}
        </Text>
      );
    } else if (m[6] && m[7]) {
      // [text](url) — resolve relative URLs to absolute for mobile
      const rawUrl = m![7];
      const resolvedUrl = rawUrl.startsWith('/') ? `${process.env.EXPO_PUBLIC_API_URL || ''}${rawUrl}` : rawUrl;
      parts.push(
        <Text
          key={key++}
          style={{ color: colors.primary, textDecorationLine: 'underline' }}
          onPress={() => Linking.openURL(resolvedUrl)}
        >
          {m[6]}
        </Text>
      );
    }

    lastIdx = m.index + m[0].length;
  }

  // Remaining text
  if (lastIdx < text.length) {
    parts.push(
      <Text key={key++} style={{ color: colors.textPrimary }}>
        {text.slice(lastIdx)}
      </Text>
    );
  }

  if (parts.length === 0) {
    parts.push(
      <Text key={0} style={{ color: colors.textPrimary }}>
        {text}
      </Text>
    );
  }

  return parts;
}

// Render a text block (with headings, lists, quotes, paragraphs)
function TextBlock({ content, colors }: { content: string; colors: any }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<View key={key++} style={{ height: SPACING.xs }} />);
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const fontSize =
        level === 1
          ? TYPOGRAPHY.fontSize.xl
          : level === 2
            ? TYPOGRAPHY.fontSize.lg
            : TYPOGRAPHY.fontSize.md;
      elements.push(
        <Text
          key={key++}
          style={{
            fontSize,
            fontFamily: TYPOGRAPHY.fontFamily.bold,
            fontWeight: TYPOGRAPHY.fontWeight.bold,
            color: colors.textPrimary,
            marginTop: SPACING.sm,
            marginBottom: SPACING.xs,
          }}
        >
          {headingMatch[2]}
        </Text>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      elements.push(
        <View
          key={key++}
          style={{
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
            paddingLeft: SPACING.sm,
            marginVertical: SPACING.xs,
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontStyle: 'italic',
              fontSize: TYPOGRAPHY.fontSize.md,
              fontFamily: TYPOGRAPHY.fontFamily.regular,
              lineHeight: TYPOGRAPHY.fontSize.md * 1.5,
            }}
          >
            {renderInlineMarkdown(trimmed.slice(2), colors)}
          </Text>
        </View>
      );
      continue;
    }

    // List items
    const listMatch = trimmed.match(/^[-*•]\s+(.+)/);
    if (listMatch) {
      elements.push(
        <View key={key++} style={{ flexDirection: 'row', marginVertical: 2, paddingLeft: SPACING.sm }}>
          <Text style={{ color: colors.textPrimary, marginRight: SPACING.xs }}>•</Text>
          <Text
            style={{
              flex: 1,
              color: colors.textPrimary,
              fontSize: TYPOGRAPHY.fontSize.md,
              fontFamily: TYPOGRAPHY.fontFamily.regular,
              lineHeight: TYPOGRAPHY.fontSize.md * 1.5,
            }}
          >
            {renderInlineMarkdown(listMatch[1], colors)}
          </Text>
        </View>
      );
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      elements.push(
        <View key={key++} style={{ flexDirection: 'row', marginVertical: 2, paddingLeft: SPACING.sm }}>
          <Text style={{ color: colors.textSecondary, marginRight: SPACING.xs, minWidth: 20 }}>
            {numberedMatch[1]}.
          </Text>
          <Text
            style={{
              flex: 1,
              color: colors.textPrimary,
              fontSize: TYPOGRAPHY.fontSize.md,
              fontFamily: TYPOGRAPHY.fontFamily.regular,
              lineHeight: TYPOGRAPHY.fontSize.md * 1.5,
            }}
          >
            {renderInlineMarkdown(numberedMatch[2], colors)}
          </Text>
        </View>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <Text
        key={key++}
        style={{
          color: colors.textPrimary,
          fontSize: TYPOGRAPHY.fontSize.md,
          fontFamily: TYPOGRAPHY.fontFamily.regular,
          lineHeight: TYPOGRAPHY.fontSize.md * 1.5,
          marginVertical: 1,
        }}
      >
        {renderInlineMarkdown(trimmed, colors)}
      </Text>
    );
  }

  return <View>{elements}</View>;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onQuizAnswer, sessionId, interactiveConfirmation }) => {
  const { colors } = useTheme();

  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'entity':
            return (
              <EntityCard key={index} type={block.meta || ''} data={block.data} />
            );
          case 'quiz':
            return <QuizBlock key={index} data={block.data} onAnswer={onQuizAnswer} />;
          case 'flashcard':
            return <FlashcardBlock key={index} data={block.data} />;
          case 'youtube':
            return <YouTubeBlock key={index} data={block.data} />;
          case 'diagram':
            return <DiagramBlock key={index} data={block.data} />;
          case 'image':
            return <ImageBlock key={index} data={block.data} />;
          case 'chart':
            return <ChartBlock key={index} data={block.data} />;
          case 'confirmation':
            return (
              <ConfirmationBlock
                key={index}
                data={block.data}
                sessionId={sessionId}
                interactive={interactiveConfirmation}
              />
            );
          case 'code':
            return (
              <CodeBlock key={index} language={block.meta || ''} code={block.content} />
            );
          case 'loading': {
            return (
              <View key={index} style={[styles.loadingBlock, { backgroundColor: colors.surface, borderColor: colors.borderColor }]}>
                <ShimmerPlaceholder width="60%" height={14} borderRadius={BORDER.radius.sm} />
                <ShimmerPlaceholder width="100%" height={48} borderRadius={BORDER.radius.md} />
                <ShimmerPlaceholder width="100%" height={48} borderRadius={BORDER.radius.md} />
                <ShimmerPlaceholder width="80%" height={48} borderRadius={BORDER.radius.md} />
              </View>
            );
          }
          case 'text':
          default:
            return <TextBlock key={index} content={block.content} colors={colors} />;
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs,
  },
  loadingBlock: {
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: BORDER.radius.lg,
    borderWidth: BORDER.width.thin,
    marginVertical: SPACING.sm,
  },
});

export default MarkdownRenderer;
