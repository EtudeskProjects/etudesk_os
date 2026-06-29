/**
 * Community Generation Prompt — XML Scaffolding
 */

import { toTOON } from '../toon';

const COMMUNITY_OUTPUT_CONTRACT = {
  suggested_name: 'Nom amélioré (max 60 caractères)',
  description: '500-800 caractères, objectifs et mission',
  tags: ['1-3 tags'],
  skills: [{ name: 'Nom de compétence concret (ex: "Machine Learning", "Communication")', role: 'topic ou validates' }],
  sectors: ['OBLIGATOIRE, 1-5 valeurs EXACTES parmi la liste de secteurs ci-dessous'],
  rules: "3-5 règles avec '• ' comme puce, séparées par \\n",
  visibility: 'PUBLIC ou PRIVATE',
  is_paid: false,
  monthly_price: 0,
  application_questions: ['2-4 questions courtes'],
};

interface CommunityPromptContext {
  communityName: string;
  orgName: string;
  orgType: string;
  orgSectors: string;
  orgDescription: string;
  orgLocation: string;
  sectorsList: string;
  languageName: string;
  existingDataContext?: string;
}

export function buildCommunityGenPrompt(ctx: CommunityPromptContext): string {
  return `<role>Expert en création et gestion de communautés en ligne</role>

<context>
Organisation : ${ctx.orgName} (${ctx.orgType})
Secteurs : ${ctx.orgSectors}
Localisation : ${ctx.orgLocation}${ctx.orgDescription ? `\nDescription : ${ctx.orgDescription}` : ''}
Communauté demandée : "${ctx.communityName}"
${ctx.existingDataContext || ''}
</context>

<task>Génère des suggestions complètes pour cette communauté. Si des données existantes sont fournies, améliore-les et complète les champs faibles sans ignorer le contexte déjà saisi.</task>

<output_format>
Retourne un JSON valide.
Contrat compact (TOON) :
${toTOON(COMMUNITY_OUTPUT_CONTRACT)}
</output_format>

<rules>
1. Tags valides : PROFESSIONAL, STUDENT, ENTREPRENEUR, TECH, CREATIVE, SOCIAL_IMPACT, ALUMNI, WOMEN, YOUTH, CLUB_ASSOCIATION
2. Secteurs OBLIGATOIRES — choisis 1 à 5 valeurs EXACTES parmi : [${ctx.sectorsList}]. Privilégie les secteurs de l'organisation (${ctx.orgSectors}) puis ajoute ceux pertinents pour la communauté.
3. Si is_paid est true, monthly_price doit être cohérent avec la devise et le marché explicitement fournis; sinon reste conservateur et ne suppose aucun pays.
4. Content in ${ctx.languageName}, concise and professional
5. Visibilité généralement PUBLIC sauf contexte spécifique
</rules>`;
}

export const COMMUNITY_GEN_SYSTEM_PROMPT = `<role>Expert en création de communautés en ligne</role>
<rules>
1. Réponds toujours en JSON valide
2. Content in English, concise and professional
</rules>`;

export function buildCommunityGenSystemPrompt(languageName: string): string {
  return `<role>Expert en création de communautés en ligne</role>
<rules>
1. Réponds toujours en JSON valide
2. Content in ${languageName}, concise and professional
3. JAMAIS de tiret cadratin "—" ni demi-cadratin "–" : trait d'union simple "-", virgule ou deux phrases.
</rules>`;
}
