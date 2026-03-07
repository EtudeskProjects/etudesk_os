/**
 * Organization Document Extraction Prompt
 * Model: gpt-5-mini (vision) | Output: JSON
 * Dedicated to organizational documents — NO skill extraction
 */

import { toTOON } from '../toon';

const ORG_EXTRACTION_OUTPUT_CONTRACT = {
  detected_type: 'POLICY | CONTRACT | REPORT | BROCHURE | PRESENTATION | CHARTER | LEGAL | OTHER',
  detected_category: 'ADMINISTRATIVE | COMMERCIAL | LEGAL | OTHER',
  confidence_score: '0.0-1.0',
  title: 'Titre du document',
  issuer: 'Émetteur/Organisation',
  issue_date: 'YYYY-MM-DD',
  expiry_date: 'YYYY-MM-DD',
  description: 'Brève description du contenu',
  tags: ['tag1', 'tag2'],
  summary: 'Résumé en une ou deux phrases',
};

export function buildOrgExtractionPrompt(mimeType: string): string {
  return `Analyse ce document d'organisation (${mimeType}) et extrais les informations.

Format de sortie :
Retourne un JSON valide.
Contrat compact (TOON) :
${toTOON(ORG_EXTRACTION_OUTPUT_CONTRACT)}

Règles :
- detected_type doit être l'un des 8 types listés
- detected_category doit correspondre au type détecté
- Tags : 3 à 10 mots-clés pertinents décrivant le contenu
- Omets les champs non trouvés plutôt que null
- NE PAS extraire de compétences, expériences, langues ou titres de poste
- JSON valide uniquement`;
}

export const ORG_EXTRACTION_SYSTEM_PROMPT = `Tu es un extracteur de métadonnées de documents organisationnels (politiques, contrats, rapports, brochures, chartes, documents juridiques). Réponds uniquement en JSON valide. N'extrais PAS de compétences ni de données personnelles.`;
