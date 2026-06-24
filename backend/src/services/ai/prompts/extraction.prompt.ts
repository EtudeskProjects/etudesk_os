/**
 * Document Extraction Prompt
 * Model: gpt-5-mini (vision) | Output: JSON
 */

import { toTOON } from '../toon';

const EXTRACTION_OUTPUT_CONTRACT = {
  detected_type: 'CV | CERTIFICATE | DIPLOMA | LICENSE | PORTFOLIO | RECOMMENDATION_LETTER | TRANSCRIPT | PUBLICATION | PATENT | ID_CARD | PASSPORT | DRIVER_LICENSE | STUDENT_CARD | PROOF_OF_ADDRESS | OTHER',
  detected_category: 'PROFESSIONAL | ACADEMIC | IDENTITY | OTHER',
  confidence_score: '0.0-1.0',
  title: 'Titre du document',
  issuer: 'Émetteur/Organisation',
  issue_date: 'YYYY-MM-DD',
  expiry_date: 'YYYY-MM-DD',
  description: 'Brève description',
  skills: [
    {
      name: 'Nom de compétence concret et standard (sera mappé au catalogue Etudesk)',
      type: 'hard_skill | soft_skill | knowledge',
      proficiency_hint: 'beginner | intermediate | advanced | master',
      context: "Contexte reliant la compétence à une expérience",
    },
  ],
  experience_years: 0,
  languages: ['Français'],
  job_titles: ['Titre'],
  field_of_study: 'Domaine',
  institution: 'Institution',
  grade: 'Note/Mention',
  full_name: 'Nom complet trouvé dans le document',
  tags: ['tag1', 'tag2'],
  summary: 'Résumé en une phrase',
};

export function buildExtractionPrompt(mimeType: string, talentContext?: string, existingSkills?: string[]): string {
  const contextBlock = talentContext
    ? `\nContexte du talent :\n${talentContext}\n`
    : '';

  const existingSkillsBlock = existingSkills && existingSkills.length > 0
    ? `\nCompétences DÉJÀ enregistrées (NE PAS ré-extraire) :\n${existingSkills.join(', ')}\n`
    : '';

  return `Analyse ce document (${mimeType}) et extrais les informations.
${contextBlock}${existingSkillsBlock}
Format de sortie :
Retourne un JSON valide.
Contrat compact (TOON) :
${toTOON(EXTRACTION_OUTPUT_CONTRACT)}

Règles pour les compétences :
- Noms avec casse naturelle (ex: "Gestion de projet", "Analyse de données", "Machine learning")
- Acronymes en majuscules quand pertinent (ex: "IA", "R&D", "SQL", "API")
- hard_skill = technique/mesurable, soft_skill = comportemental, knowledge = savoir théorique
- Utilise des noms de compétences concrets et standards (ils sont ensuite mappés au référentiel Etudesk ; les noms trop vagues seront ignorés)
- Proficiency : master (5+ ans), advanced (3-5 ans), intermediate (1-3 ans), beginner (< 1 an)
- Context : relie à l'expérience/formation avec entité et période si possible
- EXCLURE toute compétence déjà listée dans "Compétences DÉJÀ enregistrées" — ne retourne QUE les NOUVELLES compétences
- Si une compétence existante a un nom similaire (variante, synonyme, traduction), ne pas la dupliquer
- 3 à 30 compétences NOUVELLES max, pas de doublons
- Si le document est un CV/résumé et contient des expériences, réalisations, expertises ou domaines d'intervention, le champ "skills" est OBLIGATOIRE
- Pour un CV, préfère une liste de compétences explicites et actionnables plutôt que des tags génériques
- N'utilise PAS "tags" comme substitut à "skills" sur un CV
- Omets les champs non trouvés plutôt que null
- JSON valide uniquement`;
}

export const EXTRACTION_SYSTEM_PROMPT = `Tu es un extracteur de métadonnées de documents professionnels et académiques. Réponds uniquement en JSON valide. Extrais les compétences avec une casse naturelle (pas de Title Case forcé), en gardant les acronymes pertinents en majuscules, avec les types hard_skill, soft_skill ou knowledge. Ne duplique JAMAIS une compétence déjà existante dans le profil du talent.`;
