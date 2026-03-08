/**
 * Session Utils Prompts — XML Scaffolding
 * For session title generation and prompt suggestions
 */

import { toTOON } from '../toon';

const SUGGESTIONS_OUTPUT_CONTRACT = ['suggestion 1', 'suggestion 2', 'suggestion 3'];
const INTENT_SUGGESTIONS_OUTPUT_CONTRACT = ['suggestion 1', 'suggestion 2', 'suggestion 3', 'suggestion 4'];

export function buildSessionTitleSystemPrompt(languageName: string = 'English'): string {
  return `You generate concise conversation titles.

Task:
- Return exactly one short session title in ${languageName}.

Rules:
1. 2 to 6 words only
2. Plain text only
3. No quotes
4. No markdown
5. No full sentence
6. No assistant-style reply
7. No punctuation at the end
8. Reflect the user's actual topic

Good examples:
- Fintech opportunities Abidjan
- React hooks mastery
- CV improvement plan
- Linear functions practice
- Etudesk onboarding`;
}

export const SESSION_TITLE_SYSTEM_PROMPT = buildSessionTitleSystemPrompt('English');

export function buildSuggestionsSystemPrompt(mode: string, contextSummary: string, languageName: string = 'English'): string {
  const modeLabel = mode === 'study' ? "d'étude" : "d'exploration";
  return `<role>Assistant ${modeLabel}</role>

<context>
${contextSummary}
</context>

<task>Génère exactement 3 suggestions de prompts courts en ${languageName}.</task>

<output_format>
Retourne un JSON array valide.
Contrat compact (TOON) :
${toTOON(SUGGESTIONS_OUTPUT_CONTRACT)}
</output_format>

<rules>
1. Retourne un JSON array de 3 strings
2. Rien d'autre que le JSON array
3. Suggestions courtes et pertinentes
4. En ${languageName}
</rules>`;
}

/**
 * Build a prompt for intent prediction based on conversation history
 * Used with gpt-5-nano for fast, contextual suggestions
 */
export function buildIntentSuggestionsPrompt(
  mode: string,
  conversationHistory: Array<{ role: string; content: string }>,
  talentContext?: { firstName?: string; goals?: string[]; sectors?: string[] },
  languageName: string = 'English'
): string {
  // Format recent history (last 4 messages max)
  const recentHistory = conversationHistory.slice(-4);
  const historyText = recentHistory.length > 0
    ? recentHistory.map(m => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content.slice(0, 120)}`).join('\n')
    : '';

  // Format talent context if available
  const contextParts: string[] = [];
  if (talentContext?.firstName) contextParts.push(`Prenom: ${talentContext.firstName}`);
  if (talentContext?.goals?.length) contextParts.push(`Objectifs: ${talentContext.goals.slice(0, 3).join(', ')}`);
  if (talentContext?.sectors?.length) contextParts.push(`Secteurs: ${talentContext.sectors.slice(0, 3).join(', ')}`);
  const talentInfo = contextParts.length > 0 ? contextParts.join(' | ') : '';

  // Platform capabilities per mode
  const capabilities = mode === 'study'
    ? `- Expliquer un sujet ou concept en detail
- Creer un quiz ou des flashcards sur un sujet
- Creer un plan de revision personnalise
- Resumer ou analyser un document uploade (CV, cours, memo)
- Preparer un entretien (questions types, simulation)
- Generer un CV PDF personnalise
- Evaluer mes competences et identifier les lacunes
- Rechercher des infos sur le web (tendances, salaires, metiers)`
    : `- Chercher des opportunites qui matchent mon profil (emploi, stage, freelance)
- Decouvrir des communautes par secteur ou interet
- Trouver et reserver des espaces de coworking
- Generer un CV PDF a partir de mon profil
- Ajouter ou mettre a jour mes competences
- Analyser mon profil et suggerer des ameliorations
- Postuler a une offre ou rejoindre une communaute
- Rechercher des organisations ou entreprises
- Preparer un entretien pour une offre specifique`;

  return `You MUST return all suggestions in ${languageName}.
Tu es un assistant qui predit les 4 prochaines questions qu'un utilisateur pourrait poser sur une plateforme de carriere et formation en Afrique.

<capacites_plateforme>
${capabilities}
</capacites_plateforme>
${talentInfo ? `\n<profil_utilisateur>\n${talentInfo}\n</profil_utilisateur>` : ''}
${historyText ? `\n<derniers_messages>\n${historyText}\n</derniers_messages>` : ''}

Genere exactement 4 suggestions courtes (max 45 caracteres) que l'utilisateur taperait. Chaque suggestion doit etre une action concrete liee aux capacites de la plateforme.
${historyText ? "Base-toi sur le contexte de la conversation pour proposer la suite logique." : "Propose des actions de decouverte variees et utiles."}

Retourne UNIQUEMENT un JSON array valide de 4 strings, rien d'autre.
Contrat compact (TOON) :
${toTOON(INTENT_SUGGESTIONS_OUTPUT_CONTRACT)}
${mode === 'study'
    ? 'Exemple: ["Prepare-moi pour un entretien", "Evalue mes competences en Python", "Cree un quiz sur le marketing digital", "Resume mon CV et conseille-moi"]'
    : 'Exemple: ["Offres de stage en marketing a Abidjan", "Genere mon CV en PDF", "Communautes tech dans mon secteur", "Ajoute React a mes competences"]'}`;
}
