/**
 * Session Utils Prompts — XML Scaffolding
 * For session title generation and prompt suggestions
 */

export const SESSION_TITLE_SYSTEM_PROMPT = `<role>Conservateur de titres de sessions érudites</role>

<task>Attribuez un titre distingué et évocateur (3-6 mots max) en français à cette conversation, reflétant son essence stratégique.</task>

<rules>
1. Pas de guillemets
2. Pas de ponctuation finale
3. 3 à 6 mots maximum
4. Langage soutenu et précis
5. En français
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

/**
 * Build a prompt for intent prediction based on conversation history
 * Used with gpt-4.1-nano for fast, contextual suggestions
 */
export function buildIntentSuggestionsPrompt(
  mode: string,
  conversationHistory: Array<{ role: string; content: string }>,
  talentContext?: { firstName?: string; goals?: string[]; sectors?: string[] }
): string {
  const modeLabel = mode === 'study' ? "d'étude" : "d'exploration";

  // Format recent history (last 6 messages max)
  const recentHistory = conversationHistory.slice(-6);
  const historyText = recentHistory.length > 0
    ? recentHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}`).join('\n')
    : 'Aucun historique';

  // Format talent context if available
  const contextParts: string[] = [];
  if (talentContext?.firstName) contextParts.push(`Prénom: ${talentContext.firstName}`);
  if (talentContext?.goals?.length) contextParts.push(`Objectifs: ${talentContext.goals.slice(0, 3).join(', ')}`);
  if (talentContext?.sectors?.length) contextParts.push(`Secteurs: ${talentContext.sectors.slice(0, 3).join(', ')}`);
  const talentInfo = contextParts.length > 0 ? contextParts.join('\n') : '';

  return `<role>Éminence grise pour l'anticipation d'intentions ${modeLabel}</role>

<task>Anticipez avec sagacité les 4 prochaines orientations ou requêtes probables de l'utilisateur pour guider son ascension.</task>

<user_profile>
${talentInfo || 'Non disponible'}
</user_profile>

<recent_chat>
${historyText}
</recent_chat>

<output_format>
["suggestion d'instruction 1", "suggestion 2", "suggestion 3", "suggestion 4"]
</output_format>

<rules>
1. Retourne UNIQUEMENT un JSON array de 4 strings.
2. Chaque suggestion est une ORIENTATION ou une QUESTION de haute valeur (max 50 car.) que l'utilisateur formulerait.
3. Sois très spécifique au contexte du dernier message si présent.
4. ${mode === 'study' ? 'Ex: "Approfondir cette notion", "Évaluer mes acquis", "Élucider ce concept"' : 'Ex: "Explorer les opportunités d\'élite", "Solliciter cette institution", "Bonifier mon profil"'}
5. Aucun préambule, uniquement le tableau JSON.
6. Langage élégant et français.
</rules>`;
}

