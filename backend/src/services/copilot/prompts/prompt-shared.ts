/**
 * Shared prompt utilities — DRY helpers used across all 3 prompts.
 * Reduces code duplication; each helper is called once per prompt build.
 */

export type PromptLanguage = 'fr' | 'en';

/** Banned phrases block — identical across all 3 prompts */
export function getBannedPhrasesRule(language?: PromptLanguage): string {
  return `BANNED PHRASES: "Je vais", "Permettez-moi de", "Je commence", "Je lance", "Un instant", "Laissez-moi". Start with confident opener THEN call tools.`;
}

/** Active skill injection block — OVERRIDE MODE header */
export function getActiveSkillBlock(instructions?: string): string {
  if (!instructions) return '';

  return `
# ACTIVE SKILL — OVERRIDE MODE

A specific skill was triggered. These instructions OVERRIDE the general Tool Sequencing Rules above. Follow the step-by-step workflow below EXACTLY — do not improvise, do not skip steps, do not use tools not listed in the skill.

${instructions}

**END OF SKILL INSTRUCTIONS — follow them precisely.**
`;
}

/** Quick acknowledgment rule — identical across all 3 prompts */
export function getQuickAcknowledgmentRule(): string {
  return `**Quick Acknowledgment (CRITICAL)**: BEFORE calling any tool, output ONE short sentence (max 12 words) acknowledging the request. Natural, confident opener — NOT a narration of your process.`;
}

/** Off-topic warmth rule */
export function getOffTopicRule(): string {
  return `**Off-Topic Warmth**: If the user sends an off-topic message, acknowledge briefly with warmth (1 sentence), then naturally redirect to platform capabilities.`;
}

/** Regional context rule */
export function getRegionalContextRule(): string {
  return `**Regional Context**: For benchmarks (salaries, trends, market data), ALWAYS prioritize French-speaking African data (UEMOA, CEMAC). Use XOF as default currency. Silicon Valley benchmarks are irrelevant to users in Abidjan.`;
}

/**
 * Chart quality rules — centralized block injected into all 3 prompts.
 * Controls when and how the agent should generate chart blocks.
 */
export function getChartRulesBlock(): string {
  return `**Chart Quality Rules (MANDATORY):**
- **Minimum 2 non-zero items** for bar/donut/stacked_bar/line charts. For 1 data point → use **metric** card or plain text.
- **Exclude zero-value items** — bars/slices at 0 add visual noise, omit them from data arrays.
- **Human-readable labels only** — NEVER use raw numbers, enum codes, or IDs as labels. BAD: \`"value":2\` for proficiency level. GOOD: use a **table** with text labels (Débutant, Intermédiaire, Expert).
- **Values = quantities, not ordinal levels** — bar/donut values must be counts, percentages, or amounts. Proficiency levels (BEGINNER=1, etc.) are NOT bar-appropriate. Use **table** (with text labels) or **radar** (for multi-axis comparison) instead.
- **Chart type selection guide:**
  - **bar** → comparing quantities across ≥2 categories (counts, scores, percentages)
  - **donut** → distribution/proportions across ≥2 categories
  - **stacked_bar** → multi-segment comparison across ≥2 items
  - **metric** → single KPI with optional trend (the ONLY chart for 1 data point)
  - **table** → detailed data, text-based comparisons, proficiency levels, structured lists
  - **radar** → multi-axis balance (≥3 axes, same numeric scale)
  - **line** → time series or progression over ≥2 points`;
}

/** Conversational steering rules — identical across all 3 prompts */
export function getConversationalSteeringBlock(): string {
  return `## Conversational Steering
- Dissatisfaction ("pas ca", "non") → do NOT restart. Ask ONE question ("Qu'est-ce qui manquait ?"), then refine.
- Use previous results to EXCLUDE. Never repeat same search with same parameters.
- After 3+ exchanges on same topic, synthesize: "Si je comprends bien, tu cherches X avec Y mais pas Z — correct ?"`;
}
