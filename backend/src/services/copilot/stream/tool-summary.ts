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
  org_revenue: 'Revenus',
  org_invitations: 'Invitations',
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
  if (isError) {
    const msg = typeof output === 'string'
      ? output
      : (output as any)?.message || (output as any)?.error || 'Erreur inconnue';
    return `Erreur: ${String(msg).slice(0, 100)}`;
  }

  try {
    switch (toolName) {
      case 'vector_query': {
        const results = Array.isArray(output) ? output : (output as any)?.results;
        const count = Array.isArray(results) ? results.length : 0;
        const ns = args?.namespace as string | undefined;
        const typeLabel = ns ? NAMESPACE_LABELS[ns] || ns : '';
        const countText = count > 0
          ? `${count} résultat${count > 1 ? 's' : ''}`
          : 'Aucun résultat';
        return typeLabel ? `${countText} · ${typeLabel}` : countText;
      }

      case 'sql_query': {
        const intent = args?.intent as string | undefined;
        const intentLabel = intent ? INTENT_LABELS[intent] || intent.replace(/_/g, ' ') : '';
        let countText = 'Données chargées';
        if (Array.isArray(output)) {
          const count = output.length;
          countText = count > 0 ? `${count} élément${count > 1 ? 's' : ''}` : 'Aucun résultat';
        } else if (typeof output === 'object' && output !== null) {
          const rows = (output as any)?.rows || (output as any)?.data;
          if (Array.isArray(rows)) {
            const count = rows.length;
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

      case 'generate_document':
        return 'Document généré';

      case 'generate_image':
        return 'Image générée';

      case 'generate_diagram':
        return 'Diagramme généré';

      case 'web_search':
        return 'Recherche terminée';

      case 'file_read': {
        const name = args?.fileName || args?.name || args?.file;
        return name ? `Lu · ${String(name).slice(0, 60)}` : 'Document lu';
      }

      default:
        return 'Terminé';
    }
  } catch {
    return 'Terminé';
  }
}
