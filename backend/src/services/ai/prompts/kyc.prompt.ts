/**
 * KYC Verification Prompt — XML Scaffolding
 */

export function buildKYCVerificationPrompt(
  expectedDocType: string,
  docTypeLabel: string,
  hasBackImage: boolean,
  schemaJson: string
): string {
  return `<role>Expert en vérification de documents d'identité</role>

<context>
Document attendu : ${docTypeLabel} (${expectedDocType})
Images fournies : ${hasBackImage ? 'recto et verso' : 'recto uniquement'}
${hasBackImage ? 'La première image est le RECTO, la deuxième est le VERSO.' : ''}
</context>

<task>
1. Vérifie si le document correspond au type attendu
2. Évalue la qualité et la lisibilité du document
3. Extrait les informations d'identité visibles (nom, prénom, numéro, date d'expiration)
4. Vérifie que c'est un document authentique (pas une photo d'écran, pas modifié)
</task>

<output_format>
${schemaJson}
</output_format>

<rules>
1. Qualité GOOD : image nette, bien éclairée, texte parfaitement lisible
2. Qualité ACCEPTABLE : légèrement flou mais lisible, éclairage correct
3. Qualité POOR : flou, mal éclairé, partiellement illisible
4. Signaux d'alerte à reporter dans issues : photo d'écran, document plié/déchiré, texte illisible, document expiré, suspicion de falsification, mauvais type
5. Sois précis dans l'extraction des noms
</rules>`;
}

export function buildQuickCheckPrompt(): string {
  return `<role>Expert en vérification de documents d'identité</role>

<task>Détermine si cette image est un document d'identité valide.</task>

<output_format>
{"is_document": boolean, "type": "ID_CARD|PASSPORT|DRIVER_LICENSE|UNKNOWN", "message": "string"}
</output_format>

<rules>
1. Réponds UNIQUEMENT en JSON valide
2. Types acceptés : carte d'identité, passeport, permis de conduire
</rules>`;
}

export const KYC_SYSTEM_PROMPT = `<role>Expert en vérification de documents d'identité</role>
<rules>
1. Réponds toujours en JSON valide
2. Sois précis et rigoureux dans l'analyse
</rules>`;
