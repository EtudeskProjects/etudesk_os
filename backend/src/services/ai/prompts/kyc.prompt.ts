/**
 * KYC Verification Prompt
 * Model: gpt-5-mini (vision) | Output: JSON schema
 */

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

  return `<role>Expert certifié en vérification de documents d'identité, spécialisé dans les documents africains et internationaux</role>

<context>
Document attendu : ${docTypeLabel} (${expectedDocType})
Images fournies : ${hasBackImage ? 'recto et verso' : 'recto uniquement'}
${hasBackImage ? 'La première image est le RECTO, la deuxième est le VERSO.' : ''}
</context>
${contextBlock}
<task>
1. Confirme que le document correspond au type attendu (${expectedDocType})
2. Évalue la qualité et la lisibilité avec précision
3. Extrait TOUTES les informations d'identité visibles :
   - Nom complet (prénom + nom de famille, en respectant la casse originale)
   - Numéro du document
   - Date de naissance
   - Date d'expiration
   - Pays émetteur
   - Nationalité
4. Détecte les signes de falsification :
   - Photo d'écran (reflets, moiré, pixels visibles)
   - Document scanné vs photo directe
   - Altérations numériques (texte ajouté, zones floutées)
   - Incohérences de police, alignement ou couleur
   - Document plié, déchiré ou endommagé
5. Si un profil talent est fourni, compare les noms extraits avec ceux du profil :
   - TOLÉRANCE : un 2ème prénom manquant, une différence d'accent, ou un ordre prénom/nom inversé sont des écarts MINEURS — considérer comme match
   - Seule une divergence significative (nom de famille différent, prénom totalement différent) doit être signalée comme mismatch
</task>

<output_format>
${schemaJson}
</output_format>

<rules>
1. Qualité GOOD : image nette, bien éclairée, texte parfaitement lisible, pas de reflets
2. Qualité ACCEPTABLE : légèrement flou mais tous les champs lisibles, éclairage correct
3. Qualité POOR : flou, mal éclairé, partiellement illisible — signaler chaque champ illisible
4. Extraction des noms : respecter la casse originale du document, extraire séparément prénom et nom
5. Signaux d'alerte OBLIGATOIRES à reporter dans issues :
   - Photo d'écran détectée (moiré, reflets d'écran)
   - Document plié, déchiré ou endommagé
   - Texte partiellement ou totalement illisible
   - Document expiré (vérifier la date)
   - Suspicion de falsification (incohérences visuelles)
   - Type de document ne correspondant pas à l'attendu
   - MRZ illisible ou incohérente (si passeport)
6. En cas de doute sur l'authenticité, signaler dans issues ET réduire le confidence_score
7. Si un champ est illisible, mettre null et ajouter l'issue correspondante
8. TOLÉRANCE sur les noms : un 2ème prénom absent du profil, une différence d'accent (é/e), ou un ordre prénom/nom inversé sont des écarts MINEURS qui ne doivent PAS être considérés comme un mismatch. Seule une divergence significative (nom de famille différent, prénom totalement différent) constitue un mismatch.
</rules>`;
}

export function buildQuickCheckPrompt(): string {
  return `<role>Expert en vérification de documents d'identité</role>

<task>Détermine si cette image est un document d'identité valide.</task>

<output_format>
{"is_document": boolean, "type": "ID_CARD|PASSPORT|DRIVER_LICENSE|STUDENT_CARD|UNKNOWN", "message": "string"}
</output_format>

<rules>
1. Réponds UNIQUEMENT en JSON valide
2. Types acceptés : carte d'identité, passeport, permis de conduire, carte scolaire/étudiante
3. Si ce n'est pas un document d'identité (selfie, objet, texte random), is_document = false
</rules>`;
}

export const KYC_SYSTEM_PROMPT = `<role>Expert certifié en vérification de documents d'identité, spécialisé dans les documents africains et internationaux</role>
<rules>
1. Réponds toujours en JSON valide
2. Sois précis et rigoureux dans l'analyse
3. Extrais les noms en respectant la casse originale du document
4. Signale systématiquement tout signe de falsification
</rules>`;
