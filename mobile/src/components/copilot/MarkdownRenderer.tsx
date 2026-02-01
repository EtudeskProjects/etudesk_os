/**
 * MarkdownRenderer — Custom markdown parser for copilot messages
 * Detects special blocks (entity, quiz, flashcard, youtube, diagram, image, chart, code)
 * and renders them as interactive components.
 * Standard markdown: **bold**, _italic_, # headings, - lists, [links](url), > quotes
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { SPACING, TYPOGRAPHY, BORDER } from '../../constants/theme';
import { EntityCard } from './EntityCard';
import { QuizBlock } from './blocks/QuizBlock';
import { FlashcardBlock } from './blocks/FlashcardBlock';
import { YouTubeBlock } from './blocks/YouTubeBlock';
import { DiagramBlock } from './blocks/DiagramBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { ChartBlock } from './blocks/ChartBlock';
import { CodeBlock } from './blocks/CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

// Parse content into blocks
interface Block {
  type: 'text' | 'entity' | 'quiz' | 'flashcard' | 'youtube' | 'diagram' | 'image' | 'chart' | 'code';
  content: string;
  meta?: string; // entity type, language, etc.
  data?: any; // parsed JSON data
}

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  // Match fenced code blocks: ```type[:subtype]\n...\n```
  const blockRegex = /```([\w:-]+)\n([\s\S]*?)```/g;
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

    // Entity blocks: entity:opportunity, entity:community, etc.
    if (tag.startsWith('entity:')) {
      const entityType = tag.replace('entity:', '');
      try {
        const data = JSON.parse(body);
        blocks.push({ type: 'entity', content: body, meta: entityType, data });
      } catch {
        blocks.push({ type: 'text', content: body });
      }
    }
    // Quiz block
    else if (tag === 'quiz') {
      try {
        blocks.push({ type: 'quiz', content: body, data: JSON.parse(body) });
      } catch {
        blocks.push({ type: 'text', content: body });
      }
    }
    // Flashcard block
    else if (tag === 'flashcard') {
      try {
        blocks.push({ type: 'flashcard', content: body, data: JSON.parse(body) });
      } catch {
        blocks.push({ type: 'text', content: body });
      }
    }
    // YouTube block
    else if (tag === 'youtube') {
      try {
        blocks.push({ type: 'youtube', content: body, data: JSON.parse(body) });
      } catch {
        blocks.push({ type: 'text', content: body });
      }
    }
    // Diagram block
    else if (tag === 'diagram') {
      try {
        blocks.push({ type: 'diagram', content: body, data: JSON.parse(body) });
      } catch {
        blocks.push({ type: 'text', content: body });
      }
    }
    // Image block
    else if (tag === 'image') {
      try {
        blocks.push({ type: 'image', content: body, data: JSON.parse(body) });
      } catch {
        blocks.push({ type: 'text', content: body });
      }
    }
    // Chart block
    else if (tag === 'chart') {
      try {
        blocks.push({ type: 'chart', content: body, data: JSON.parse(body) });
      } catch {
        blocks.push({ type: 'text', content: body });
      }
    }
    // Code blocks: code:javascript or just javascript, python, etc.
    else {
      const language = tag.replace('code:', '');
      blocks.push({ type: 'code', content: body, meta: language });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) blocks.push({ type: 'text', content: text });
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
            fontFamily: 'Courier',
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
      // [text](url)
      parts.push(
        <Text
          key={key++}
          style={{ color: colors.primary, textDecorationLine: 'underline' }}
          onPress={() => Linking.openURL(m![7])}
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

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
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
            return <QuizBlock key={index} data={block.data} />;
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
          case 'code':
            return (
              <CodeBlock key={index} language={block.meta || ''} code={block.content} />
            );
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
});

export default MarkdownRenderer;
