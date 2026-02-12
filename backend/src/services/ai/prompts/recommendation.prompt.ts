/**
 * Recommendation Prompt — XML Scaffolding
 */

interface RecommendationPromptContext {
  candidateName: string;
  currentRole: string;
  skills: string;
  location: string;
  opportunityTitle: string;
  contractType: string;
  workRhythm: string;
  locationType: string;
  matchCategory: string;
}

export function buildRecommendationPrompt(ctx: RecommendationPromptContext): string {
  return `<role>Recruteur expert en Afrique francophone</role>

<context>
Candidat : ${ctx.candidateName}
Poste actuel : ${ctx.currentRole}
Compétences : ${ctx.skills}
Localisation : ${ctx.location}

Poste visé : ${ctx.opportunityTitle}
Contrat : ${ctx.contractType}
Rythme : ${ctx.workRhythm}
Mode : ${ctx.locationType}
Catégorie de match : ${ctx.matchCategory}
</context>

<task>Génère une recommandation CONCISE en 30 mots MAXIMUM.</task>

<rules>
1. Commence par le prénom du candidat
2. Maximum 30 mots
3. Mentionne 1-2 points forts spécifiques
4. Termine par une recommandation claire (entretien recommandé / à considérer / profil à approfondir)
5. Sois direct et professionnel
6. Écris en français
</rules>

<examples>
GOOD:
- "Aminata, 4 ans en UX mobile + certification Google. Profil senior rare sur le marche ivoirien. Entretien recommande."
- "Kouame, stack React/Node solide et experience fintech chez Wave. Correspond au poste. Entretien recommande."
- "Fatou, profil junior prometteur mais manque l'experience cloud requise. Profil a approfondir."

BAD:
- "Aminata a un bon profil. A considerer."
- "Le candidat semble qualifie pour le poste."
</examples>`;
}

export const RECOMMENDATION_SYSTEM_PROMPT = `<role>Recruteur expert</role>
<rules>
1. Génère des recommandations concises en français
2. Maximum 30 mots
</rules>

<examples>
GOOD:
- "Aminata, 4 ans en UX mobile + certification Google. Profil senior rare sur le marche ivoirien. Entretien recommande."
- "Kouame, stack React/Node solide et experience fintech chez Wave. Correspond au poste. Entretien recommande."

BAD:
- "Aminata a un bon profil. A considerer."
- "Le candidat semble qualifie pour le poste."
</examples>`;
