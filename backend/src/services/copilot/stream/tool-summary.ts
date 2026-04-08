/**
 * Tool Summary Generator
 * Generates human-readable French summaries for tool execution results
 * Includes args context for richer tool block display
 */

const NAMESPACE_LABELS: Record<string, string> = {
  opportunities: 'opportunités',
  communities: 'communautés',
  spaces: 'espaces',
  talents: 'talents',
  organizations: 'organisations',
};

const INTENT_LABELS: Record<string, string> = {
  my_profile: 'Mon profil',
  my_applications: 'Mes candidatures',
  my_reservations: 'Mes réservations',
  my_invitations: 'Mes invitations',
  my_communities: 'Mes communautés',
  my_bookmarks: 'Mes favoris',
  my_documents: 'Mes documents',
  my_skills: 'Mes compétences',
  org_members: 'Membres',
  org_applications: 'Candidatures reçues',
  org_stats: 'Statistiques',
  org_opportunities: 'Opportunités',
  org_communities: 'Communautés',
  org_spaces: 'Espaces',
  org_invitations: 'Invitations',
  org_documents: 'Documents organisation',
  org_talents: 'Talents CRM',
  org_talent_profile: 'Profil talent',
  org_community_feed: 'Activités communauté',
  org_community_members: 'Membres communauté',
  org_skills_analytics: 'Analyse compétences',
  org_application_funnel: 'Entonnoir candidatures',
  org_talent_cohorts: 'Cohortes talents',
  org_geo_distribution: 'Répartition géographique',
  org_community_engagement: 'Engagement communautés',
  org_opportunity_performance: 'Performance opportunités',
  my_community_feed: 'Feed communauté',
  my_community_members: 'Membres communauté',
  search_opportunities: 'Recherche opportunités',
  search_communities: 'Recherche communautés',
  search_spaces: 'Recherche espaces',
  search_organizations: 'Recherche organisations',
  search_talents: 'Recherche talents',
  apply_opportunity: 'Candidature',
  join_community: 'Adhésion communauté',
  book_space: 'Réservation espace',
  create_activity: 'Création activité',
  respond_invitation: 'Réponse invitation',
  update_application: 'Mise à jour candidature',
};

export function generateToolSummary(
  toolName: string,
  output: unknown,
  isError: boolean,
  args?: Record<string, unknown>
): string {
  const outputObj = (output && typeof output === 'object') ? (output as any) : null;
  if (!isError && outputObj && outputObj.success === false) {
    const msg = outputObj.error || outputObj.message || 'Action non réalisée';
    return `Erreur: ${String(msg).slice(0, 100)}`;
  }

  if (isError) {
    const msg = typeof output === 'string'
      ? output
      : (output as any)?.message || (output as any)?.error || 'Erreur inconnue';
    return `Erreur: ${String(msg).slice(0, 100)}`;
  }

  try {
    switch (toolName) {
      case 'smart_search': {
        const results = Array.isArray(output) ? output : (output as any)?.results;
        const count = Array.isArray(results) ? results.length : 0;
        const entity = args?.entity as string | undefined;
        const typeLabel = entity ? NAMESPACE_LABELS[entity] || entity : '';
        const source = (output as any)?.source;
        const sourceLabel = source ? ` (${source})` : '';
        const countText = count > 0
          ? `${count} résultat${count > 1 ? 's' : ''}`
          : 'Aucun résultat';
        return typeLabel ? `${countText} · ${typeLabel}${sourceLabel}` : `${countText}${sourceLabel}`;
      }

      case 'sql_query': {
        const intent = args?.intent as string | undefined;
        const intentLabel = intent ? INTENT_LABELS[intent] || intent.replace(/_/g, ' ') : '';
        let countText = 'Données chargées';
        if (Array.isArray(output)) {
          const count = output.length;
          countText = count > 0 ? `${count} élément${count > 1 ? 's' : ''}` : 'Aucun résultat';
        } else if (typeof output === 'object' && output !== null) {
          // Search for the first array value in the output object
          // Handles: { applications: [...] }, { communities: [...] }, { skills: [...] }, etc.
          const obj = output as Record<string, unknown>;
          const arrayKey = Object.keys(obj).find(k => Array.isArray(obj[k]));
          if (arrayKey) {
            const arr = obj[arrayKey] as unknown[];
            const count = arr.length;
            countText = count > 0 ? `${count} élément${count > 1 ? 's' : ''}` : 'Aucun résultat';
          }
        }
        return intentLabel ? `${countText} · ${intentLabel}` : countText;
      }

      case 'youtube_search': {
        const videos = Array.isArray(output) ? output : (output as any)?.results || (output as any)?.videos;
        const count = Array.isArray(videos) ? videos.length : 0;
        return count > 0 ? `${count} vidéo${count > 1 ? 's' : ''} trouvée${count > 1 ? 's' : ''}` : 'Aucune vidéo';
      }

      case 'generate_document': {
        const docId = (output as any)?.id;
        const docTitle = (output as any)?.metadata?.title || (output as any)?.filename;
        const label = docTitle ? `Document généré · ${String(docTitle).slice(0, 50)}` : 'Document généré';
        return docId ? `${label} (sauvegardé)` : label;
      }

      case 'generate_image':
        return 'Image générée';

      case 'generate_diagram':
        return 'Diagramme généré';

      case 'web_search':
        if ((output as any)?.results?.length === 0) {
          return 'Aucune source fiable trouvée';
        }
        return 'Recherche web terminée';

      case 'file_reader':
      case 'file_read': {
        // Try to extract document title from the output (sub-agent result)
        const docTitle = (output as any)?.document?.title
          || (output as any)?.title;
        const extractionMode = (output as any)?.document?.extractionMode;
        if (extractionMode === 'unavailable') {
          return docTitle ? `Extraction indisponible · ${String(docTitle).slice(0, 60)}` : 'Extraction indisponible';
        }
        if (extractionMode === 'salvaged') {
          return docTitle ? `Lu (mode dégradé) · ${String(docTitle).slice(0, 60)}` : 'Document lu (mode dégradé)';
        }
        if (docTitle) return `Lu · ${String(docTitle).slice(0, 60)}`;
        const name = args?.fileName || args?.name || args?.file;
        return name ? `Lu · ${String(name).slice(0, 60)}` : 'Document lu';
      }

      case 'manage_skills': {
        const action = args?.action as string | undefined;
        const skill = args?.skillName as string | undefined;
        const actionLabels: Record<string, string> = {
          add: 'Ajoutée',
          update: 'Mise à jour',
        };
        const actionLabel = action ? actionLabels[action] || action : 'Modifiée';
        return skill ? `${actionLabel} · ${skill}` : `Compétence ${actionLabel.toLowerCase()}`;
      }

      case 'execute_action': {
        const action = args?.action as string | undefined;
        const actionLabels: Record<string, string> = {
          apply_opportunity: 'Candidature soumise',
          join_community: 'Communauté rejointe',
          book_space: 'Espace réservé',
          accept_invitation: 'Invitation acceptée',
          decline_invitation: 'Invitation déclinée',
          create_agenda_trigger: 'Trigger créé',
          update_agenda_trigger: 'Trigger mis à jour',
        };
        return action ? actionLabels[action] || 'Action effectuée' : 'Action effectuée';
      }

      default:
        return 'Terminé';
    }
  } catch {
    return 'Terminé';
  }
}
