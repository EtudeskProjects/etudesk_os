/**
 * Session Summarizer
 * Uses Claude Haiku to summarize long conversations.
 * Keeps last 3 messages verbatim, summarizes the rest.
 */

import { getAnthropicClient } from '../ai/provider';
import { MODEL_FAST } from '../ai/models';
import { logger } from '../../utils';
import { SupportedLanguage } from '../../i18n';
import { getLanguageDisplayName } from '../language-preference.service';

const SUMMARY_THRESHOLD = 12; // Summarize when history exceeds this count
const KEEP_RECENT = 6; // Keep last N messages verbatim

function buildSystemPrompt(languageName: string): string {
  return `You are a conversation summarizer for a talent/employment platform.

Summarize the conversation in ${languageName}. Focus on:
- What the user asked for (topics, entities mentioned)
- What tools were used and what results were found
- Any actions taken (skills added, applications made)
- Key preferences or context established

ALSO capture (critical for conversation continuity):
- Implicit preferences discovered (prefers remote, interested in fintech, avoids large corporates, prefers practical over theoretical)
- Dead ends: searches that returned no useful results — and what was wrong with them
- Refinements: what the user rejected and what they kept, what filters worked
- Pending threads: topics started but not resolved

Keep the summary very concise (max 150 words). Use short bullet points (one line each).
Start with "[Résumé]" header. Omit greetings and pleasantries.`;
}

/**
 * Summarizes conversation history if it exceeds the threshold.
 * Returns the processed history (summary + recent messages).
 */
export async function summarizeHistoryIfNeeded(
  history: Array<{ role: string; content: string }>,
  language: SupportedLanguage = 'en'
): Promise<Array<{ role: string; content: string }>> {
  if (history.length <= SUMMARY_THRESHOLD) {
    return history;
  }

  try {
    // Split: older messages to summarize, recent to keep
    const toSummarize = history.slice(0, -KEEP_RECENT);
    const recentMessages = history.slice(-KEEP_RECENT);

    // Format older messages for summarization
    const conversationText = toSummarize
      .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content.slice(0, 500)}`)
      .join('\n\n');

    const client = getAnthropicClient();
    const languageName = getLanguageDisplayName(language);
    const response = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 512,
      system: buildSystemPrompt(languageName),
      messages: [{ role: 'user', content: conversationText }],
    });

    const summary = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('')
      .trim();

    if (!summary) {
      return history;
    }

    // Return: summary as system context + recent messages
    return [
      { role: 'user', content: summary },
      { role: 'assistant', content: language === 'fr' ? 'Compris, je prends en compte le contexte précédent.' : 'Understood, I will keep the previous context in mind.' },
      ...recentMessages,
    ];
  } catch (error: any) {
    logger.error(`[session-summarizer] Error: ${error.message}`);
    // Fallback: just return recent messages to avoid token overflow
    return history.slice(-KEEP_RECENT);
  }
}
