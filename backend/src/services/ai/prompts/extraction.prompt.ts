/**
 * Document Extraction Prompt
 * Model: vision model | Output: JSON
 */

import { toTOON } from '../toon';
import type { Competency } from '../../skills/catalog.service';

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
      slug: 'slug exact présent dans COMPÉTENCES AUTORISÉES',
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

export function buildExtractionPrompt(mimeType: string, talentContext?: string, existingSkills?: string[], allowedCompetencies: Competency[] = []): string {
  const contextBlock = talentContext
    ? `\nContexte du talent :\n${talentContext}\n`
    : '';

  const existingSkillsBlock = existingSkills && existingSkills.length > 0
    ? `\nCompétences DÉJÀ enregistrées (NE PAS ré-extraire) :\n${existingSkills.join(', ')}\n`
    : '';
  const allowedBlock = allowedCompetencies.length
    ? `\nCOMPÉTENCES AUTORISÉES (sélection du référentiel, slug | nom | type) :\n${allowedCompetencies.map((c) => `- ${c.slug} | ${c.name_fr || c.name} | ${c.type}`).join('\n')}\n`
    : '\nCOMPÉTENCES AUTORISÉES : aucune candidate suffisamment pertinente. Retourne [] pour skills.\n';

  return `Analyse ce document (${mimeType}) et extrais les informations.
${contextBlock}${existingSkillsBlock}${allowedBlock}
Format de sortie :
Retourne un JSON valide.
Contrat compact (TOON) :
${toTOON(EXTRACTION_OUTPUT_CONTRACT)}

Règles pour les compétences :
- Retourne UNIQUEMENT un slug exact de COMPÉTENCES AUTORISÉES. N'invente jamais un slug, nom, type ou famille.
- Si aucune compétence autorisée ne correspond clairement, retourne un tableau skills vide.
- Traite indépendamment knowledge, hard_skill, soft_skill, tool_platform et language. Cherche des preuves explicites dans le document pour chaque axe, puis consolide dans un unique tableau skills sans doublon.
- Proficiency : master (5+ ans), advanced (3-5 ans), intermediate (1-3 ans), beginner (< 1 an)
- Context : relie à l'expérience/formation avec entité et période si possible
- EXCLURE toute compétence déjà listée dans "Compétences DÉJÀ enregistrées" — ne retourne QUE les NOUVELLES compétences
- Si une compétence existante a un nom similaire (variante, synonyme, traduction), ne pas la dupliquer
- Pour un CV, vise une couverture équilibrée des axes réellement étayés, sans imposer un minimum artificiel et sans dépasser 30 compétences.
- Si le document est un CV/résumé et contient des expériences, réalisations, expertises ou domaines d'intervention, le champ "skills" est OBLIGATOIRE
- Pour un CV, préfère une liste de compétences explicites et actionnables plutôt que des tags génériques
- N'utilise PAS "tags" comme substitut à "skills" sur un CV
- Omets les champs non trouvés plutôt que null
- JSON valide uniquement`;
}

export const EXTRACTION_SYSTEM_PROMPT = `Tu es un extracteur de métadonnées de documents professionnels et académiques. Réponds uniquement en JSON valide. Extrais les compétences avec une casse naturelle (pas de Title Case forcé), en gardant les acronymes pertinents en majuscules, avec les types hard_skill, soft_skill ou knowledge. Ne duplique JAMAIS une compétence déjà existante dans le profil du talent.`;
