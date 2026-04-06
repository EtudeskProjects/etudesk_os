/**
 * Copilot Trace Service — DPO Few-Shot Injection
 * Queries winning trajectories (user_rating=3, no errors) per skill
 * and formats them as few-shot examples for prompt injection.
 */

import { pool } from '../database';
import { logger } from '../../utils';

interface WinningTrajectory {
  skill_id: string;
  user_message: string;
  tool_sequence: string[];
  output_preview: string;
}

// In-memory cache: skill_id → formatted examples (TTL 30 min)
const trajectoryCache = new Map<string, { text: string; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Get winning trajectory examples for a skill.
 * Returns a formatted block ready for prompt injection, or empty string if none.
 * Cached 30 minutes per skill.
 */
export async function getWinningTrajectories(skillId: string, limit = 2): Promise<string> {
  // Check cache
  const cached = trajectoryCache.get(skillId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.text;
  }

  try {
    const result = await pool.query(
      `SELECT
         ct.tool_names,
         ct.tool_count,
         ct.duration_ms,
         ct.output_chars,
         -- Get the user message that triggered this exchange
         (SELECT content FROM copilot_messages
          WHERE session_id = ct.session_id AND role = 'user' AND deleted_at IS NULL
          AND created_at <= cm.created_at
          ORDER BY created_at DESC LIMIT 1
         ) as user_message,
         -- Get a preview of the assistant output
         substring(cm.content, 1, 300) as output_preview
       FROM copilot_traces ct
       JOIN copilot_messages cm ON cm.id = ct.message_id
       WHERE ct.skill_id = $1
         AND ct.user_rating = 3
         AND ct.tool_errors = 0
         AND ct.guardrail_blocked = false
         AND cm.deleted_at IS NULL
       ORDER BY ct.created_at DESC
       LIMIT $2`,
      [skillId, limit]
    );

    if (result.rows.length === 0) {
      trajectoryCache.set(skillId, { text: '', expiresAt: Date.now() + CACHE_TTL_MS });
      return '';
    }

    const examples = result.rows.map((row: any, i: number) => {
      const tools = (row.tool_names || []).join(' → ');
      const userMsg = (row.user_message || '').trim();
      const output = (row.output_preview || '').trim();
      return `Example ${i + 1}:
  User: "${userMsg}"
  Tools: ${tools || 'none'}
  Result: ${output}...`;
    });

    const text = `<winning_trajectories skill="${skillId}">
The following are examples of highly-rated responses for this skill. Use them as guidance for tool sequencing and response style.

${examples.join('\n\n')}
</winning_trajectories>`;

    trajectoryCache.set(skillId, { text, expiresAt: Date.now() + CACHE_TTL_MS });
    return text;
  } catch (error) {
    logger.error(`[trace.service] Failed to load winning trajectories for ${skillId}:`, error);
    return '';
  }
}

/**
 * Invalidate the trajectory cache for a skill (e.g., after new rating).
 */
export function invalidateTrajectoryCache(skillId?: string): void {
  if (skillId) {
    trajectoryCache.delete(skillId);
  } else {
    trajectoryCache.clear();
  }
}
