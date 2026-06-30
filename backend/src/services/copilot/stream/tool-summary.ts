/**
 * Tool Summary Generator
 * Generates human-readable summaries for tool execution results
 * Includes args context for richer tool block display
 */

import { SupportedLanguage } from '../../../i18n';

const NAMESPACE_LABELS: Record<string, { fr: string; en: string }> = {
  opportunities: { fr: 'opportunités', en: 'opportunities' },
  communities: { fr: 'communautés', en: 'communities' },
  spaces: { fr: 'espaces', en: 'spaces' },
  talents: { fr: 'talents', en: 'talents' },
  organizations: { fr: 'organisations', en: 'organizations' },
};

const INTENT_LABELS: Record<string, { fr: string; en: string }> = {
  my_profile: { fr: 'Mon profil', en: 'My profile' },
  my_applications: { fr: 'Mes candidatures', en: 'My applications' },
  my_reservations: { fr: 'Mes réservations', en: 'My reservations' },
  my_invitations: { fr: 'Mes invitations', en: 'My invitations' },
  my_communities: { fr: 'Mes communautés', en: 'My communities' },
  my_bookmarks: { fr: 'Mes favoris', en: 'My bookmarks' },
  my_documents: { fr: 'Mes documents', en: 'My documents' },
  my_skills: { fr: 'Mes compétences', en: 'My skills' },
  org_members: { fr: 'Membres', en: 'Members' },
  org_applications: { fr: 'Candidatures reçues', en: 'Received applications' },
  org_stats: { fr: 'Statistiques', en: 'Stats' },
  org_opportunities: { fr: 'Opportunités', en: 'Opportunities' },
  org_communities: { fr: 'Communautés', en: 'Communities' },
  org_spaces: { fr: 'Espaces', en: 'Spaces' },
  org_invitations: { fr: 'Invitations', en: 'Invitations' },
  org_documents: { fr: 'Documents organisation', en: 'Organization documents' },
  org_talents: { fr: 'Talents CRM', en: 'CRM talents' },
  org_talent_profile: { fr: 'Profil talent', en: 'Talent profile' },
  org_community_feed: { fr: 'Activités communauté', en: 'Community activity' },
  org_community_members: { fr: 'Membres communauté', en: 'Community members' },
  org_skills_analytics: { fr: 'Analyse compétences', en: 'Skills analytics' },
  org_application_funnel: { fr: 'Entonnoir candidatures', en: 'Application funnel' },
  org_talent_cohorts: { fr: 'Cohortes talents', en: 'Talent cohorts' },
  org_geo_distribution: { fr: 'Répartition géographique', en: 'Geographic distribution' },
  org_community_engagement: { fr: 'Engagement communautés', en: 'Community engagement' },
  org_opportunity_performance: { fr: 'Performance opportunités', en: 'Opportunity performance' },
  my_community_feed: { fr: 'Feed communauté', en: 'Community feed' },
  my_community_members: { fr: 'Membres communauté', en: 'Community members' },
  search_opportunities: { fr: 'Recherche opportunités', en: 'Opportunity search' },
  search_communities: { fr: 'Recherche communautés', en: 'Community search' },
  search_spaces: { fr: 'Recherche espaces', en: 'Space search' },
  search_organizations: { fr: 'Recherche organisations', en: 'Organization search' },
  search_talents: { fr: 'Recherche talents', en: 'Talent search' },
  apply_opportunity: { fr: 'Candidature', en: 'Application' },
  join_community: { fr: 'Adhésion communauté', en: 'Community membership' },
  book_space: { fr: 'Réservation espace', en: 'Space booking' },
  create_activity: { fr: 'Création activité', en: 'Activity creation' },
  respond_invitation: { fr: 'Réponse invitation', en: 'Invitation response' },
  update_application: { fr: 'Mise à jour candidature', en: 'Application update' },
};

export function generateToolSummary(
  toolName: string,
  output: unknown,
  isError: boolean,
  args?: Record<string, unknown>,
  language: SupportedLanguage = 'en'
): string {
  const isFrench = language === 'fr';
  const tr = {
    error: isFrench ? 'Erreur' : 'Error',
    actionNotDone: isFrench ? 'Action non réalisée' : 'Action not completed',
    unknownError: isFrench ? 'Erreur inconnue' : 'Unknown error',
    noResult: isFrench ? 'Aucun résultat' : 'No results',
    dataLoaded: isFrench ? 'Données chargées' : 'Data loaded',
    element: (count: number) => isFrench
      ? `${count} élément${count > 1 ? 's' : ''}`
      : `${count} item${count > 1 ? 's' : ''}`,
    result: (count: number) => isFrench
      ? `${count} résultat${count > 1 ? 's' : ''}`
      : `${count} result${count > 1 ? 's' : ''}`,
    video: (count: number) => isFrench
      ? `${count} vidéo${count > 1 ? 's' : ''} trouvée${count > 1 ? 's' : ''}`
      : `${count} video${count > 1 ? 's' : ''} found`,
    noVideo: isFrench ? 'Aucune vidéo' : 'No videos',
    generatedDocument: isFrench ? 'Document généré' : 'Document generated',
    saved: isFrench ? 'sauvegardé' : 'saved',
    generatedImage: isFrench ? 'Image générée' : 'Image generated',
    generatedDiagram: isFrench ? 'Diagramme généré' : 'Diagram generated',
    noWebSource: isFrench ? 'Aucune source fiable trouvée' : 'No reliable sources found',
    webDone: isFrench ? 'Recherche web terminée' : 'Web search complete',
    extractionUnavailable: isFrench ? 'Extraction indisponible' : 'Extraction unavailable',
    degradedRead: isFrench ? 'Lu (mode dégradé)' : 'Read (degraded mode)',
    documentRead: isFrench ? 'Document lu' : 'Document read',
    read: isFrench ? 'Lu' : 'Read',
    referential: isFrench ? 'Référentiel' : 'Catalog',
    catalogSearch: isFrench ? 'Recherche référentiel' : 'Catalog search',
    graph: isFrench ? 'Graphe compétences' : 'Skill graph',
    skill: isFrench ? 'Compétence' : 'Skill',
    skillUpdated: isFrench ? 'Compétence mise à jour' : 'Skill updated',
    actionDone: isFrench ? 'Action effectuée' : 'Action completed',
    done: isFrench ? 'Terminé' : 'Done',
  };
  const outputObj = (output && typeof output === 'object') ? (output as any) : null;
  if (!isError && outputObj && outputObj.success === false) {
    const msg = outputObj.error || outputObj.message || tr.actionNotDone;
    return `${tr.error}: ${String(msg).slice(0, 100)}`;
  }

  if (isError) {
    const msg = typeof output === 'string'
      ? output
      : (output as any)?.message || (output as any)?.error || tr.unknownError;
    return `${tr.error}: ${String(msg).slice(0, 100)}`;
  }

  try {
    switch (toolName) {
      case 'smart_search': {
        const results = Array.isArray(output) ? output : (output as any)?.results;
        const count = Array.isArray(results) ? results.length : 0;
        const entity = args?.entity as string | undefined;
        const typeLabel = entity ? NAMESPACE_LABELS[entity]?.[isFrench ? 'fr' : 'en'] || entity : '';
        const countText = count > 0 ? tr.result(count) : tr.noResult;
        return typeLabel ? `${countText} · ${typeLabel}` : countText;
      }

      case 'sql_query': {
        const intent = args?.intent as string | undefined;
        const intentLabel = intent ? INTENT_LABELS[intent]?.[isFrench ? 'fr' : 'en'] || intent.replace(/_/g, ' ') : '';
        let countText = tr.dataLoaded;
        if (Array.isArray(output)) {
          const count = output.length;
          countText = count > 0 ? tr.element(count) : tr.noResult;
        } else if (typeof output === 'object' && output !== null) {
          // Search for the first array value in the output object
          // Handles: { applications: [...] }, { communities: [...] }, { skills: [...] }, etc.
          const obj = output as Record<string, unknown>;
          const arrayKey = Object.keys(obj).find(k => Array.isArray(obj[k]));
          if (arrayKey) {
            const arr = obj[arrayKey] as unknown[];
            const count = arr.length;
            countText = count > 0 ? tr.element(count) : tr.noResult;
          }
        }
        return intentLabel ? `${countText} · ${intentLabel}` : countText;
      }

      case 'youtube_search': {
        const videos = Array.isArray(output) ? output : (output as any)?.results || (output as any)?.videos;
        const count = Array.isArray(videos) ? videos.length : 0;
        return count > 0 ? tr.video(count) : tr.noVideo;
      }

      case 'generate_document': {
        const docId = (output as any)?.id;
        const docTitle = (output as any)?.metadata?.title || (output as any)?.filename;
        const label = docTitle ? `${tr.generatedDocument} · ${String(docTitle).slice(0, 50)}` : tr.generatedDocument;
        return docId ? `${label} (${tr.saved})` : label;
      }

      case 'generate_image':
        return tr.generatedImage;

      case 'generate_diagram':
        return tr.generatedDiagram;

      case 'web_search':
        if ((output as any)?.results?.length === 0) {
          return tr.noWebSource;
        }
        return tr.webDone;

      case 'file_reader':
      case 'file_read': {
        // Try to extract document title from the output (sub-agent result)
        const docTitle = (output as any)?.document?.title
          || (output as any)?.title;
        const extractionMode = (output as any)?.document?.extractionMode;
        if (extractionMode === 'unavailable') {
          return docTitle ? `${tr.extractionUnavailable} · ${String(docTitle).slice(0, 60)}` : tr.extractionUnavailable;
        }
        if (extractionMode === 'salvaged') {
          return docTitle ? `${tr.degradedRead} · ${String(docTitle).slice(0, 60)}` : `${tr.documentRead} (${isFrench ? 'mode dégradé' : 'degraded mode'})`;
        }
        if (docTitle) return `${tr.read} · ${String(docTitle).slice(0, 60)}`;
        const name = args?.fileName || args?.name || args?.file;
        return name ? `${tr.read} · ${String(name).slice(0, 60)}` : tr.documentRead;
      }

      case 'find_competency': {
        const q = args?.query as string | undefined;
        const inCat = outputObj?.in_catalog as boolean | undefined;
        const name = outputObj?.competency?.name as string | undefined;
        if (inCat && name) return `${tr.referential} · ${name}`;
        if (q) return `${tr.referential} · "${q}"`;
        return tr.catalogSearch;
      }

      case 'competency_graph': {
        const name = outputObj?.competency?.name as string | undefined;
        const q = args?.query as string | undefined;
        return name ? `${tr.graph} · ${name}` : q ? `${tr.graph} · ${q}` : tr.graph;
      }

      case 'manage_skills': {
        // Prefer the resolved catalog skill name from the result; fall back to the query label.
        const resolvedName = outputObj?.skill?.name as string | undefined;
        const skill = resolvedName || (args?.skillQuery as string | undefined) || (args?.skillName as string | undefined);
        const level = outputObj?.skill?.level as string | undefined;
        if (skill) return level ? `${tr.skill} · ${skill} (${level})` : `${tr.skill} · ${skill}`;
        return tr.skillUpdated;
      }

      case 'execute_action': {
        const action = args?.action as string | undefined;
        const actionLabels: Record<string, { fr: string; en: string }> = {
          apply_opportunity: { fr: 'Candidature soumise', en: 'Application submitted' },
          join_community: { fr: 'Communauté rejointe', en: 'Community joined' },
          book_space: { fr: 'Espace réservé', en: 'Space booked' },
          accept_invitation: { fr: 'Invitation acceptée', en: 'Invitation accepted' },
          decline_invitation: { fr: 'Invitation déclinée', en: 'Invitation declined' },
          create_agenda_trigger: { fr: 'Trigger créé', en: 'Trigger created' },
          update_agenda_trigger: { fr: 'Trigger mis à jour', en: 'Trigger updated' },
        };
        return action ? actionLabels[action]?.[isFrench ? 'fr' : 'en'] || tr.actionDone : tr.actionDone;
      }

      default:
        return tr.done;
    }
  } catch {
    return tr.done;
  }
}
