/**
 * Space Generation Prompt — XML Scaffolding
 */

import { toTOON } from '../toon';

const SPACE_OUTPUT_CONTRACT = {
  suggested_name: 'Nom amélioré (max 60 caractères)',
  description: 'Description 300-500 caractères, caractéristiques et usage',
  sectors: ['1-5 secteurs parmi la liste'],
  skills: [{ name: 'Compétence technique/outil concret activé par le lieu (ex: "Impression 3D", "Montage vidéo")', role: 'validates' }],
  equipment: ['Codes d’équipements UPPER_SNAKE_CASE'],
  amenities: ['Codes de services et commodités UPPER_SNAKE_CASE'],
  surface_m2: 0,
  capacity: 0,
  rules: "3-5 points avec '• ' comme puce, séparés par \\n",
  hourly_rate: 0,
  daily_rate: 0,
  weekly_rate: 0,
  monthly_rate: 0,
  questions: ['2-4 questions pour réservations'],
};

interface SpacePromptContext {
  spaceName: string;
  spaceTypeLabel: string;
  orgName: string;
  orgType: string;
  orgSectors: string;
  orgDescription: string;
  orgLocation: string;
  sectorsList: string;
  languageName: string;
  existingDataContext?: string;
}

export function buildSpaceGenPrompt(ctx: SpacePromptContext): string {
  return `<role>Expert en gestion d'espaces réservables</role>

<context>
Organisation : ${ctx.orgName} (${ctx.orgType})
Secteurs : ${ctx.orgSectors}
Localisation : ${ctx.orgLocation}${ctx.orgDescription ? `\nDescription : ${ctx.orgDescription}` : ''}
Espace demandé : "${ctx.spaceName}" de type ${ctx.spaceTypeLabel}
${ctx.existingDataContext || ''}
</context>

<task>Génère des suggestions complètes pour cet espace réservable. Si des données existantes sont fournies, améliore-les et complète les champs faibles sans ignorer le contexte déjà saisi.</task>

<output_format>
Retourne un JSON valide.
Contrat compact (TOON) :
${toTOON(SPACE_OUTPUT_CONTRACT)}
</output_format>

<rules>
1. Secteurs valides : [${ctx.sectorsList}]
2. Équipements (outils matériels) : VIDEOPROJECTOR, WHITEBOARD, FLIPCHART, SCREEN, SOUND_SYSTEM, MICROPHONE, WEBCAM, TV_SCREEN, VIDEO_CONFERENCE, COMPUTERS, PRINTERS, PHONE, DESKS
3. Services et commodités (infrastructure ou prestations) : WIFI, POWER_OUTLETS, AIR_CONDITIONING, HEATING, PARKING, CAFETERIA, KITCHEN, RESTROOMS, RECEPTION, SECURITY, ELEVATOR, NATURAL_LIGHT, SOUNDPROOF
4. Ne mets jamais WIFI ou POWER_OUTLETS dans equipment ; emploie exclusivement les codes ci-dessus, sans texte libre
5. Tarifs adaptés au type d'espace, à la localisation et à la devise explicitement fournie; ne suppose aucun pays ni devise par défaut dans le contenu généré
6. Content in ${ctx.languageName}, concise and professional
7. Règlements avec "• " comme puce, séparés par \\n (max 1000 caractères)
</rules>`;
}

export const SPACE_GEN_SYSTEM_PROMPT = `<role>Expert en gestion d'espaces réservables</role>
<rules>
1. Réponds toujours en JSON valide
2. Content in English, concise and professional
</rules>`;

export function buildSpaceGenSystemPrompt(languageName: string): string {
  return `<role>Expert en gestion d'espaces réservables</role>
<rules>
1. Réponds toujours en JSON valide
2. Content in ${languageName}, concise and professional
3. JAMAIS de tiret cadratin "—" ni demi-cadratin "–" : trait d'union simple "-", virgule ou deux phrases.
</rules>`;
}
