/**
 * Document Extraction Prompt
 * Model: gpt-4.1-mini (vision) | Output: JSON
 */

export function buildExtractionPrompt(mimeType: string, talentContext?: string): string {
  const contextBlock = talentContext
    ? `\nContexte du talent :\n${talentContext}\n`
    : '';

  return `Analyse ce document (${mimeType}) et extrais les informations en JSON.
${contextBlock}
Format de sortie :
{
  "detected_type": "CV | CERTIFICATE | DIPLOMA | LICENSE | PORTFOLIO | RECOMMENDATION_LETTER | TRANSCRIPT | PUBLICATION | PATENT | ID_CARD | PASSPORT | DRIVER_LICENSE | STUDENT_CARD | PROOF_OF_ADDRESS | OTHER",
  "detected_category": "PROFESSIONAL | ACADEMIC | IDENTITY | OTHER",
  "confidence_score": 0.0-1.0,
  "title": "Titre du document",
  "issuer": "Émetteur/Organisation",
  "issue_date": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD",
  "description": "Brève description",
  "skills": [
    {
      "name": "Nom En Title Case",
      "type": "HARD_SKILL | SOFT_SKILL | KNOWLEDGE",
      "proficiency_hint": "BEGINNER | INTERMEDIATE | EXPERT | MASTER",
      "context": "Contexte reliant la compétence à une expérience"
    }
  ],
  "experience_years": 0,
  "languages": ["Français"],
  "job_titles": ["Titre"],
  "field_of_study": "Domaine",
  "institution": "Institution",
  "grade": "Note/Mention",
  "full_name": "Nom complet trouvé dans le document",
  "tags": ["tag1", "tag2"],
  "summary": "Résumé en une phrase"
}

Règles pour les compétences :
- Noms en Title Case (ex: "Gestion De Projet", "Machine Learning")
- HARD_SKILL = technique/mesurable, SOFT_SKILL = comportemental, KNOWLEDGE = savoir théorique
- Proficiency : MASTER (5+ ans), EXPERT (3-5 ans), INTERMEDIATE (1-3 ans), BEGINNER (< 1 an)
- Context : relie à l'expérience/formation avec entité et période si possible
- 3 à 30 compétences max, pas de doublons
- Omets les champs non trouvés plutôt que null
- JSON valide uniquement`;
}

export const EXTRACTION_SYSTEM_PROMPT = `Tu es un extracteur de métadonnées de documents professionnels et académiques. Réponds uniquement en JSON valide. Extrais les compétences en Title Case avec les types HARD_SKILL, SOFT_SKILL ou KNOWLEDGE.`;
