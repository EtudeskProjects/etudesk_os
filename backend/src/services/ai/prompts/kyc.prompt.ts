/**
 * KYC Verification Prompt
 * Model: vision model | Output: JSON schema
 */

import { toTOON } from '../toon';

const QUICK_CHECK_OUTPUT = {
  is_document: true,
  type: 'ID_CARD|PASSPORT|DRIVER_LICENSE|STUDENT_CARD|UNKNOWN',
  message: 'string',
};

export function buildKYCVerificationPrompt(
  expectedDocType: string,
  docTypeLabel: string,
  hasBackImage: boolean,
  schemaJson: string,
  talentContext?: string
): string {
  const contextBlock = talentContext
    ? `\n<talent_profile>\n${talentContext}\n</talent_profile>\n`
    : '';

  return `Tu es un vérificateur de documents d'identité pour une plateforme éducative africaine.

Document attendu : ${docTypeLabel} (${expectedDocType})
Images : ${hasBackImage ? 'recto + verso (image 1 = recto, image 2 = verso)' : 'recto uniquement'}
${contextBlock}
Analyse l'image et retourne un JSON valide.
Schéma compact (TOON) :
${schemaJson}

Consignes :
- Sois TOLÉRANT : les documents africains (CEDEAO, CNI ivoirienne, carte consulaire, etc.) ont des formats variés. Accepte-les.
- Qualité GOOD = lisible et net. ACCEPTABLE = un peu flou mais lisible. POOR = illisible.
- is_valid_document = true si c'est un vrai document d'identité (même si la qualité n'est pas parfaite).
- Si le type détecté diffère du type attendu mais que c'est quand même un document d'identité valide, mets is_valid_document = true et indique le bon type dans detected_document_type.
- Extrais le nom tel qu'il apparaît sur le document. Si illisible, mets null.
- has_photo : true si une photo d'identité est visible sur le document. Pour les cartes scolaires, la photo peut être petite ou absente — ne rejette pas pour ça.
- Ne rejette que pour des raisons graves : image totalement illisible, document clairement faux/falsifié, ou ce n'est pas un document d'identité.
- front_issues : liste uniquement les problèmes réels (pas "pas de MRZ" pour une CNI).`;
}

export function buildQuickCheckPrompt(): string {
  return `<role>Expert en vérification de documents d'identité</role>

<task>Détermine si cette image est un document d'identité valide.</task>

<output_format>
Retourne un JSON valide.
Contrat compact (TOON) :
${toTOON(QUICK_CHECK_OUTPUT)}
</output_format>

<rules>
1. Réponds UNIQUEMENT en JSON valide
2. Types acceptés : carte d'identité, passeport, permis de conduire, carte scolaire/étudiante
3. Si ce n'est pas un document d'identité (selfie, objet, texte random), is_document = false
</rules>`;
}

export const KYC_SYSTEM_PROMPT = `Tu es un vérificateur de documents d'identité pour une plateforme éducative. Réponds toujours en JSON valide. Sois tolérant avec les documents africains (formats variés, qualité variable). Ne rejette que pour des raisons graves.`;
