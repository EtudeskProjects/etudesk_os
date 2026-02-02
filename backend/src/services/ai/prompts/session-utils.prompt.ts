/**
 * Session Utils Prompts — XML Scaffolding
 * For session title generation and prompt suggestions
 */

export const SESSION_TITLE_SYSTEM_PROMPT = `<role>Assistant de génération de titres de conversation</role>

<task>Génère un titre court (3-6 mots max) en français pour cette conversation.</task>

<rules>
1. Pas de guillemets
2. Pas de ponctuation finale
3. 3 à 6 mots maximum
4. En français
</rules>`;

export function buildSuggestionsSystemPrompt(mode: string, contextSummary: string): string {
  const modeLabel = mode === 'study' ? "d'étude" : "d'exploration";
  return `<role>Assistant ${modeLabel}</role>

<context>
${contextSummary}
</context>

<task>Génère exactement 3 suggestions de prompts courts en français.</task>

<output_format>
["suggestion 1", "suggestion 2", "suggestion 3"]
</output_format>

<rules>
1. Retourne un JSON array de 3 strings
2. Rien d'autre que le JSON array
3. Suggestions courtes et pertinentes
4. En français
</rules>`;
}
