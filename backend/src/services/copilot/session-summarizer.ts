/**
 * Session Summarizer
 * Uses gpt-5-nano to summarize long conversations.
 * Keeps last 4 messages verbatim, summarizes the rest.
 */

import { Agent, run } from '@openai/agents';
import { MODEL_T3 } from '../ai/models';
import { logger } from '../../utils';

const SUMMARY_THRESHOLD = 10; // Summarize when history exceeds this count
const KEEP_RECENT = 4; // Keep last N messages verbatim

const summarizerAgent = new Agent({
  name: 'Session Summarizer',
  model: MODEL_T3,
  instructions: `You are a conversation summarizer for a talent/employment platform.

Summarize the conversation in French. Focus on:
- What the user asked for (topics, entities mentioned)
- What tools were used and what results were found
- Any actions taken (skills added, applications made)
- Key preferences or context established

Keep the summary concise (max 200 words). Use bullet points.
Start with "[Résumé de la conversation précédente]" header.`,
});

/**
 * Summarizes conversation history if it exceeds the threshold.
 * Returns the processed history (summary + recent messages).
 */
export async function summarizeHistoryIfNeeded(
  history: Array<{ role: string; content: string }>
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

    const result = await run(summarizerAgent, conversationText);
    const summary = result.finalOutput?.trim();

    if (!summary) {
      return history;
    }

    // Return: summary as system context + recent messages
    return [
      { role: 'user', content: summary },
      { role: 'assistant', content: 'Compris, je prends en compte le contexte précédent.' },
      ...recentMessages,
    ];
  } catch (error: any) {
    logger.error(`[session-summarizer] Error: ${error.message}`);
    // Fallback: just return recent messages to avoid token overflow
    return history.slice(-KEEP_RECENT);
  }
}
