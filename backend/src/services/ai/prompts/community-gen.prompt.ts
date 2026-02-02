/**
 * Community Generation Prompt — XML Scaffolding
 */

interface CommunityPromptContext {
  communityName: string;
  orgName: string;
  orgType: string;
  sectorsList: string;
}

export function buildCommunityGenPrompt(ctx: CommunityPromptContext): string {
  return `<role>Expert en création et gestion de communautés en ligne en Afrique francophone</role>

<context>
Organisation : ${ctx.orgName} (${ctx.orgType})
Communauté demandée : "${ctx.communityName}"
</context>

<task>Génère des suggestions complètes pour cette communauté.</task>

<output_format>
{
  "suggested_name": "Nom amélioré (max 60 caractères)",
  "description": "500-800 caractères, objectifs et mission",
  "tags": ["1-3 tags"],
  "sectors": ["1-5 secteurs"],
  "rules": "3-5 règles avec '• ' comme puce, séparées par \\n",
  "visibility": "PUBLIC ou PRIVATE",
  "is_paid": false,
  "monthly_price": 0,
  "application_questions": ["2-4 questions courtes"]
}
</output_format>

<rules>
1. Tags valides : PROFESSIONAL, STUDENT, ENTREPRENEUR, TECH, CREATIVE, SOCIAL_IMPACT, ALUMNI, WOMEN, YOUTH, CLUB_ASSOCIATION
2. Secteurs valides : [${ctx.sectorsList}]
3. Si is_paid est true, monthly_price entre 5000-50000 XOF
4. Contenu en français, concis et professionnel
5. Visibilité généralement PUBLIC sauf contexte spécifique
</rules>`;
}

export const COMMUNITY_GEN_SYSTEM_PROMPT = `<role>Expert en création de communautés en ligne</role>
<rules>
1. Réponds toujours en JSON valide
2. Contenu en français, concis et professionnel
</rules>`;
