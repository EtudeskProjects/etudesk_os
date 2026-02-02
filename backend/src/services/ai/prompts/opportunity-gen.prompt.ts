/**
 * Opportunity Generation Prompt — XML Scaffolding
 */

interface OpportunityPromptContext {
  title: string;
  typeLabel: string;
  type: string;
  orgName: string;
  orgType: string;
  orgSectors: string;
  orgLocation: string;
  existingDataContext: string;
  schemaJson: string;
}

export function buildOpportunityGenPrompt(ctx: OpportunityPromptContext): string {
  return `<role>Expert en recrutement en Afrique francophone</role>

<context>
Organisation : ${ctx.orgName} (${ctx.orgType})
Secteurs : ${ctx.orgSectors}
Localisation : ${ctx.orgLocation}
Opportunité : "${ctx.title}" — ${ctx.typeLabel} (${ctx.type})${ctx.existingDataContext}
</context>

<task>Génère des données CONCISES pour cette opportunité.</task>

<output_format>
Respecte ce schéma JSON :
${ctx.schemaJson}
</output_format>

<rules>
1. suggested_title : Corrige/améliore le titre (professionnel, max 60 caractères)
2. summary : Description COURTE (150-300 caractères MAX)
3. requirements : 3-5 points COURTS avec "• " (max 250 caractères)
4. nice_to_have : 2-3 points COURTS avec "• " (max 150 caractères)
5. sectors : 2-5 secteurs pertinents (OBLIGATOIRE)
6. deadline_days : Stage 14-21j, Emploi 30-45j, Consultation 21-30j
7. Questions de candidature : 2-3 questions courtes et pertinentes
8. Contenu en français, concis et professionnel
9. Génère TOUJOURS compensation_min ET compensation_max
</rules>

<examples>
Salaires XOF/mois :
- Stage/Apprentissage : min 50,000 — max 150,000
- Junior : min 150,000 — max 400,000
- Mid : min 400,000 — max 800,000
- Senior : min 800,000 — max 1,500,000
</examples>`;
}

export const OPPORTUNITY_GEN_SYSTEM_PROMPT = `<role>Expert en recrutement</role>
<rules>
1. Réponds toujours en JSON valide
2. Contenu en français, concis et professionnel
</rules>`;
