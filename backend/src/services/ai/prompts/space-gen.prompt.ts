/**
 * Space Generation Prompt — XML Scaffolding
 */

interface SpacePromptContext {
  spaceName: string;
  spaceTypeLabel: string;
  orgName: string;
  orgType: string;
  sectorsList: string;
}

export function buildSpaceGenPrompt(ctx: SpacePromptContext): string {
  return `<role>Expert en gestion d'espaces réservables en Afrique francophone</role>

<context>
Organisation : ${ctx.orgName} (${ctx.orgType})
Espace demandé : "${ctx.spaceName}" de type ${ctx.spaceTypeLabel}
</context>

<task>Génère des suggestions complètes pour cet espace réservable.</task>

<output_format>
{
  "suggested_name": "Nom amélioré (max 60 caractères)",
  "description": "Description 300-500 caractères, caractéristiques et usage",
  "sectors": ["1-5 secteurs parmi la liste"],
  "equipment": ["Équipements pertinents"],
  "amenities": ["Services/commodités"],
  "surface_m2": 0,
  "capacity": 0,
  "rules": "3-5 points avec '• ' comme puce, séparés par \\n",
  "hourly_rate": 0,
  "daily_rate": 0,
  "weekly_rate": 0,
  "monthly_rate": 0,
  "questions": ["2-4 questions pour réservations"]
}
</output_format>

<rules>
1. Secteurs valides : [${ctx.sectorsList}]
2. Équipements : VIDEOPROJECTOR, WHITEBOARD, SCREEN, MICROPHONE, SPEAKER, COMPUTER, PRINTER, WEBCAM, WIFI, AIR_CONDITIONING, HEATING
3. Commodités : WIFI, PARKING, CAFETERIA, RESTROOM, ELEVATOR, SECURITY
4. Tarifs en XOF, adaptés au type d'espace et à la localisation
5. Contenu en français, concis et professionnel
6. Règlements avec "• " comme puce, séparés par \\n (max 1000 caractères)
</rules>`;
}

export const SPACE_GEN_SYSTEM_PROMPT = `<role>Expert en gestion d'espaces réservables</role>
<rules>
1. Réponds toujours en JSON valide
2. Contenu en français, concis et professionnel
</rules>`;
