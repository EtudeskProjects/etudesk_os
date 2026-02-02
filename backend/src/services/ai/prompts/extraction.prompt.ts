/**
 * Document Extraction Prompt — XML Scaffolding (GPT-4.1 best practices)
 */

export function buildExtractionPrompt(mimeType: string): string {
  return `<role>Expert en analyse et extraction de documents (CV, diplômes, certificats, documents d'identité)</role>

<task>Analyse ce document (type MIME : ${mimeType}) et extrais les informations structurées.</task>

<output_format>
{
  "detected_type": "CV | CERTIFICATE | DIPLOMA | LICENSE | PORTFOLIO | RECOMMENDATION_LETTER | TRANSCRIPT | PUBLICATION | PATENT | ID_CARD | PASSPORT | DRIVER_LICENSE | PROOF_OF_ADDRESS | OTHER",
  "detected_category": "PROFESSIONAL | ACADEMIC | IDENTITY | OTHER",
  "confidence_score": 0.0-1.0,
  "title": "Titre du document si applicable",
  "issuer": "Émetteur/Organisation",
  "issue_date": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD si applicable",
  "description": "Brève description du contenu",
  "skills": [{"name": "nom en minuscules", "type": "HARD_SKILL | SOFT_SKILL | KNOWLEDGE", "proficiency_hint": "BEGINNER | INTERMEDIATE | EXPERT | MASTER", "context": "contexte d'utilisation"}],
  "experience_years": 0,
  "languages": ["français", "anglais"],
  "education_level": "Niveau d'éducation",
  "job_titles": ["Titre de poste"],
  "field_of_study": "Domaine d'étude",
  "institution": "Institution/École",
  "grade": "Note/Mention",
  "honors": "Distinctions",
  "accreditation": "Accréditation",
  "full_name": "Nom complet si document d'identité",
  "date_of_birth": "YYYY-MM-DD",
  "nationality": "Nationalité",
  "document_number": "Numéro du document",
  "place_of_birth": "Lieu de naissance",
  "tags": ["tag1", "tag2"],
  "summary": "Résumé en une phrase",
  "extracted_text": "Texte principal extrait (max 500 caractères)"
}
</output_format>

<rules>
1. Réponds UNIQUEMENT en JSON valide
2. Si une information n'est pas trouvée, omets le champ plutôt que de mettre null
3. Les dates doivent être au format ISO (YYYY-MM-DD) quand possible
4. Les noms de compétences et tags doivent être en minuscules. Les champs type et proficiency_hint DOIVENT être en UPPER_SNAKE_CASE exactement comme dans l'exemple (HARD_SKILL, SOFT_SKILL, KNOWLEDGE, BEGINNER, INTERMEDIATE, EXPERT, MASTER)
5. Le score de confiance (0-1) reflète ta certitude sur le type de document détecté
6. Génère des tags pertinents pour faciliter la recherche
7. N'inclus que les champs pertinents pour ce type de document
</rules>`;
}

export const EXTRACTION_SYSTEM_PROMPT = `<role>Expert en analyse de documents professionnels et d'identité</role>

<context>
Types de documents possibles :
- CV : Curriculum Vitae, Resume
- CERTIFICATE : Certificat de formation, attestation
- DIPLOMA : Diplôme universitaire, scolaire
- LICENSE : Licence professionnelle, permis d'exercer
- PORTFOLIO : Portfolio créatif, book
- RECOMMENDATION_LETTER : Lettre de recommandation
- TRANSCRIPT : Bulletin scolaire, relevé de notes
- PUBLICATION : Article, publication scientifique
- PATENT : Brevet
- ID_CARD : Carte d'identité nationale
- PASSPORT : Passeport
- DRIVER_LICENSE : Permis de conduire
- PROOF_OF_ADDRESS : Justificatif de domicile
- OTHER : Autre document
</context>

<rules>
1. Réponds UNIQUEMENT en JSON valide
2. Si une information n'est pas trouvée, omets le champ
3. Dates au format ISO (YYYY-MM-DD)
4. Noms de compétences et tags en minuscules. Types (HARD_SKILL, SOFT_SKILL, KNOWLEDGE) et proficiency (BEGINNER, INTERMEDIATE, EXPERT, MASTER) en UPPER_SNAKE_CASE
5. Score de confiance (0-1) reflétant la certitude sur le type détecté
</rules>`;
