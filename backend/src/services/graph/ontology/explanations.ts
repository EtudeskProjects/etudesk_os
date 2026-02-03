/**
 * Talent Graph Ontology - French Explanations
 *
 * Human-readable explanations for all relationships in French
 * These are used by the copilot agents to explain graph connections
 */

import { RelationshipType, RelationshipTypes } from './relationships';
import { NodeLabel, NodeLabels } from './schema';

// ═══════════════════════════════════════════════════════════════
// NODE LABEL EXPLANATIONS
// ═══════════════════════════════════════════════════════════════

export const NodeExplanations: Record<NodeLabel, { name: string; description: string }> = {
  [NodeLabels.TALENT]: {
    name: 'Talent',
    description: "Un utilisateur de la plateforme à la recherche d'opportunités professionnelles ou de développement de compétences",
  },
  [NodeLabels.SKILL]: {
    name: 'Compétence',
    description: 'Une compétence technique, soft skill, langue ou outil',
  },
  [NodeLabels.ORGANIZATION]: {
    name: 'Organisation',
    description: 'Une entreprise, startup, ONG, institution gouvernementale ou établissement éducatif',
  },
  [NodeLabels.OPPORTUNITY]: {
    name: 'Opportunité',
    description: "Une offre d'emploi, de stage, de freelance, de bénévolat ou de projet",
  },
  [NodeLabels.COMMUNITY]: {
    name: 'Communauté',
    description: 'Un groupe professionnel, de networking, de mentorat ou de formation',
  },
  [NodeLabels.SPACE]: {
    name: 'Espace',
    description: 'Un espace de coworking, salle de réunion, espace événementiel ou bureau privé',
  },
  [NodeLabels.LEARNING_TOPIC]: {
    name: "Sujet d'apprentissage",
    description: "Un sujet que l'utilisateur étudie avec suivi de progression",
  },
  [NodeLabels.DOCUMENT]: {
    name: 'Document',
    description: "Un document de l'utilisateur (CV, certificat, diplôme, portfolio, etc.)",
  },
  [NodeLabels.EVENT]: {
    name: 'Événement',
    description: 'Un événement planifié (entretien, réunion, rappel, session)',
  },
  [NodeLabels.SECTOR]: {
    name: 'Secteur',
    description: "Un secteur d'activité (technologie, finance, santé, éducation, etc.)",
  },
};

// ═══════════════════════════════════════════════════════════════
// RELATIONSHIP EXPLANATIONS IN FRENCH
// ═══════════════════════════════════════════════════════════════

export interface RelationshipExplanation {
  name: string;
  description: string;
  example: string;
  contextTemplate: string; // Template for generating context sentences
}

export const RelationshipExplanations: Record<RelationshipType, RelationshipExplanation> = {
  // Talent → Skill
  [RelationshipTypes.POSSEDE_COMPETENCE]: {
    name: 'Possède cette compétence',
    description: "Indique qu'un talent maîtrise une compétence à un certain niveau",
    example: 'Marie possède la compétence Python au niveau avancé',
    contextTemplate: '{talent} possède la compétence {skill} au niveau {level}',
  },

  // Talent → Organization
  [RelationshipTypes.TRAVAILLE_CHEZ]: {
    name: 'Travaille actuellement chez',
    description: "Indique l'emploi actuel d'un talent",
    example: 'Ahmed travaille chez Google en tant que Software Engineer',
    contextTemplate: '{talent} travaille actuellement chez {org} en tant que {title}',
  },
  [RelationshipTypes.A_TRAVAILLE_CHEZ]: {
    name: 'A travaillé chez',
    description: "Indique une expérience professionnelle passée d'un talent",
    example: 'Sophie a travaillé chez Microsoft de 2020 à 2023',
    contextTemplate: '{talent} a travaillé chez {org} en tant que {title} de {start} à {end}',
  },
  [RelationshipTypes.A_ETUDIE_A]: {
    name: 'A étudié à',
    description: "Indique le parcours éducatif d'un talent",
    example: "Paul a étudié à l'Université de Paris en informatique",
    contextTemplate: '{talent} a étudié à {org} ({degree} en {field})',
  },

  // Talent → Opportunity
  [RelationshipTypes.A_POSTULE_A]: {
    name: 'A postulé à cette offre',
    description: "Indique qu'un talent a soumis une candidature pour une opportunité",
    example: 'Marc a postulé au poste de Data Scientist chez Amazon',
    contextTemplate: '{talent} a postulé à "{opportunity}" (statut: {status})',
  },
  [RelationshipTypes.A_MIS_EN_FAVORIS]: {
    name: 'A mis en favoris',
    description: "Indique qu'un talent a sauvegardé un élément pour plus tard",
    example: "Claire a mis l'offre Frontend Developer en favoris",
    contextTemplate: '{talent} a mis en favoris "{item}"',
  },

  // Talent → Community
  [RelationshipTypes.EST_MEMBRE_DE]: {
    name: 'Est membre de cette communauté',
    description: 'Indique la participation active dans une communauté',
    example: 'Fatou est membre de la communauté Women in Tech Africa',
    contextTemplate: '{talent} est membre de la communauté "{community}" depuis {date}',
  },

  // Talent → Space
  [RelationshipTypes.A_RESERVE]: {
    name: 'A réservé cet espace',
    description: "Indique qu'un talent a effectué une réservation d'espace",
    example: "Omar a réservé l'espace Impact Hub pour le 15 mars",
    contextTemplate: '{talent} a réservé "{space}" le {date} de {start} à {end}',
  },

  // Talent → Document
  [RelationshipTypes.POSSEDE_DOCUMENT]: {
    name: 'Possède ce document',
    description: "Indique un document téléchargé par l'utilisateur",
    example: 'Anna possède le document CV_2024.pdf',
    contextTemplate: '{talent} possède le document "{document}" ({type})',
  },

  // Talent → LearningTopic
  [RelationshipTypes.ETUDIE_SUJET]: {
    name: 'Étudie ce sujet',
    description: "Indique un sujet d'apprentissage actif avec progression",
    example: 'Jean étudie le sujet Machine Learning avec 65% de maîtrise',
    contextTemplate: '{talent} étudie "{topic}" (maîtrise: {mastery}%)',
  },

  // Talent → Event
  [RelationshipTypes.A_EVENEMENT]: {
    name: 'A cet événement planifié',
    description: 'Indique un événement dans le calendrier du talent',
    example: 'Lisa a un entretien planifié pour le 20 mars',
    contextTemplate: '{talent} a un {eventType} prévu le {date}: "{title}"',
  },

  // Talent ↔ Talent
  [RelationshipTypes.CONNECTE_AVEC]: {
    name: 'Est connecté avec',
    description: 'Indique une connexion professionnelle entre deux talents',
    example: 'Pierre est connecté avec Marie (ancien collègue)',
    contextTemplate: '{talent1} est connecté avec {talent2} ({type})',
  },
  [RelationshipTypes.RECOMMANDE_PAR]: {
    name: 'A été recommandé par',
    description: "Indique qu'un talent a reçu une recommandation d'un autre",
    example: "David a été recommandé par son ancien manager Sarah",
    contextTemplate: '{talent} a été recommandé par {recommender}',
  },

  // Agent-Inferred Relations
  [RelationshipTypes.INTERESSE_PAR]: {
    name: "Montre de l'intérêt pour",
    description: "Intérêt déduit par l'agent basé sur les interactions",
    example: "L'agent a détecté que Luc montre de l'intérêt pour le cloud computing",
    contextTemplate: "{talent} montre de l'intérêt pour {target} (confiance: {confidence}%)",
  },
  [RelationshipTypes.DEVRAIT_APPRENDRE]: {
    name: 'Devrait apprendre cette compétence',
    description: "Recommandation d'apprentissage générée par l'agent",
    example: "L'agent suggère que Maya devrait apprendre Docker",
    contextTemplate: '{talent} devrait apprendre {skill} (priorité: {priority}) - {reason}',
  },
  [RelationshipTypes.SIMILAIRE_A]: {
    name: 'Profil similaire à',
    description: 'Similarité de profil calculée entre deux talents',
    example: 'Le profil de Tom est similaire à celui de Julie (8 compétences communes)',
    contextTemplate: '{talent1} a un profil similaire à {talent2} ({count} compétences communes)',
  },

  [RelationshipTypes.PUBLIE_PAR]: {
    name: 'Publiée par cette organisation',
    description: "Organisation ayant publié l'opportunité",
    example: "L'offre Data Engineer a été publiée par Spotify",
    contextTemplate: '"{opportunity}" a été publiée par {org}',
  },
  [RelationshipTypes.APPARTIENT_A]: {
    name: 'Appartient à cette organisation',
    description: 'Communauté officiellement liée à une organisation',
    example: 'La communauté Google Developer Group appartient à Google',
    contextTemplate: 'La communauté "{community}" appartient à {org}',
  },
  [RelationshipTypes.PREREQUIS_POUR]: {
    name: 'Est un prérequis pour',
    description: "Compétence à maîtriser avant d'en apprendre une autre",
    example: 'Python est un prérequis pour Machine Learning',
    contextTemplate: '{skill1} est un prérequis pour {skill2}',
  },
  [RelationshipTypes.COMPLEMENTAIRE_A]: {
    name: 'Est complémentaire à',
    description: 'Compétences qui se renforcent mutuellement',
    example: 'Docker est complémentaire à Kubernetes',
    contextTemplate: '{skill1} est complémentaire à {skill2}',
  },

  // Organization → Space
  [RelationshipTypes.HEBERGE]: {
    name: 'Héberge cet espace',
    description: 'Organisation propriétaire ou gestionnaire de cet espace',
    example: 'Impact Hub héberge la salle de réunion Baobab',
    contextTemplate: '{org} héberge l\'espace "{space}"',
  },

  // Entity → Sector
  [RelationshipTypes.DANS_SECTEUR]: {
    name: 'Opère dans ce secteur',
    description: "Secteur d'activité dans lequel opère l'entité",
    example: 'Google opère dans le secteur Technologie',
    contextTemplate: '{entity} opère dans le secteur {sector}',
  },
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get a human-readable explanation for a relationship
 */
export function explainRelationship(type: RelationshipType): string {
  return RelationshipExplanations[type]?.description ?? `Relation de type ${type}`;
}

/**
 * Generate a context sentence for a relationship
 */
export function generateRelationshipContext(
  type: RelationshipType,
  params: Record<string, string | number>
): string {
  const template = RelationshipExplanations[type]?.contextTemplate;
  if (!template) return '';

  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? key));
}

/**
 * Get all relationship types for a given source node type
 */
export function getRelationshipsFrom(nodeLabel: NodeLabel): RelationshipType[] {
  const relationships: RelationshipType[] = [];

  switch (nodeLabel) {
    case NodeLabels.TALENT:
      relationships.push(
        RelationshipTypes.POSSEDE_COMPETENCE,
        RelationshipTypes.TRAVAILLE_CHEZ,
        RelationshipTypes.A_TRAVAILLE_CHEZ,
        RelationshipTypes.A_ETUDIE_A,
        RelationshipTypes.A_POSTULE_A,
        RelationshipTypes.A_MIS_EN_FAVORIS,
        RelationshipTypes.EST_MEMBRE_DE,
        RelationshipTypes.A_RESERVE,
        RelationshipTypes.POSSEDE_DOCUMENT,
        RelationshipTypes.ETUDIE_SUJET,
        RelationshipTypes.A_EVENEMENT,
        RelationshipTypes.CONNECTE_AVEC,
        RelationshipTypes.RECOMMANDE_PAR,
        RelationshipTypes.INTERESSE_PAR,
        RelationshipTypes.DEVRAIT_APPRENDRE,
        RelationshipTypes.SIMILAIRE_A
      );
      break;
    case NodeLabels.OPPORTUNITY:
      relationships.push(
        RelationshipTypes.PUBLIE_PAR
      );
      break;
    case NodeLabels.COMMUNITY:
      relationships.push(
        RelationshipTypes.APPARTIENT_A,
        RelationshipTypes.DANS_SECTEUR
      );
      break;
    case NodeLabels.ORGANIZATION:
      relationships.push(
        RelationshipTypes.HEBERGE,
        RelationshipTypes.DANS_SECTEUR
      );
      break;
    case NodeLabels.SKILL:
      relationships.push(RelationshipTypes.PREREQUIS_POUR, RelationshipTypes.COMPLEMENTAIRE_A);
      break;
    case NodeLabels.DOCUMENT:
      break;
  }

  return relationships;
}

/**
 * Format relationship type for display
 */
export function formatRelationshipType(type: RelationshipType): string {
  return RelationshipExplanations[type]?.name ?? type.replace(/_/g, ' ').toLowerCase();
}
