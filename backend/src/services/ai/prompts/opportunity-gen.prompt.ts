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
  languageName: string;
}

export function buildOpportunityGenPrompt(ctx: OpportunityPromptContext): string {
  return `<role>Expert en recrutement international pour les métiers du numérique</role>

<context>
Organisation : ${ctx.orgName} (${ctx.orgType})
Secteurs : ${ctx.orgSectors}
Localisation : ${ctx.orgLocation}
Opportunité : "${ctx.title}" — ${ctx.typeLabel} (${ctx.type})${ctx.existingDataContext}
</context>

<task>Génère des données CONCISES pour cette opportunité.</task>

<output_format>
Retourne un JSON valide.
Contrat de sortie compact (TOON) :
${ctx.schemaJson}
</output_format>

<rules>
1. suggested_title : Corrige/améliore le titre (professionnel, max 60 caractères)
2. summary : Description COURTE (150-300 caractères MAX)
3. requirements : 3-5 points COURTS avec "• " (max 250 caractères)
4. nice_to_have : 2-3 points COURTS avec "• " (max 150 caractères)
5. skills : 12-16 compétences CONCRÈTES et STANDARDS (noms réels mappables à un référentiel, ex: "React", "Node.js", "Gestion de projet", "SQL", "Communication"), chacune avec requirement "required" ou "nice_to_have". Au MOINS 12 pour garantir une liste riche. Des NOMS de compétences, pas des phrases.
6. sectors : 2-5 secteurs pertinents (OBLIGATOIRE)
6. deadline_days : Stage 14-21j, Emploi 30-45j, Consultation 21-30j
7. Questions de candidature : 2-3 questions courtes et pertinentes
8. Content in ${ctx.languageName}, concise and professional
9. Génère TOUJOURS compensation_min ET compensation_max. Utilise la devise déjà fournie par l'organisation ou la requête; sinon génère des montants cohérents sans supposer de pays.
</rules>

<examples>
Repères de rémunération :
- Stage/Apprentissage : fourchette locale d'entrée
- Junior : fourchette locale junior
- Mid : fourchette locale intermédiaire
- Senior : fourchette locale senior
</examples>`;
}

export const OPPORTUNITY_GEN_SYSTEM_PROMPT = `<role>Expert en recrutement</role>
<rules>
1. Réponds toujours en JSON valide
2. Content in English, concise and professional
</rules>`;

export function buildOpportunityGenSystemPrompt(languageName: string): string {
  return `<role>Expert en recrutement</role>
<rules>
1. Réponds toujours en JSON valide
2. Content in ${languageName}, concise and professional
3. JAMAIS de tiret cadratin "—" ni demi-cadratin "–" : trait d'union simple "-", virgule ou deux phrases.
</rules>`;
}
