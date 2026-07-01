/**
 * Tool Summary Generator
 * Generates human-readable summaries for tool execution results
 * Includes args context for richer tool block display
 */

import { SupportedLanguage } from '../../../i18n';

type LocalizedLabel = Partial<Record<SupportedLanguage, string>>;

const NAMESPACE_LABELS: Record<string, LocalizedLabel> = {
  opportunities: { fr: 'opportunités', en: 'opportunities', es: 'oportunidades', it: 'opportunità', de: 'Opportunities', zh: '机会', ar: 'الفرص' },
  communities: { fr: 'communautés', en: 'communities', es: 'comunidades', it: 'community', de: 'Communities', zh: '社区', ar: 'المجتمعات' },
  spaces: { fr: 'espaces', en: 'spaces', es: 'espacios', it: 'spazi', de: 'Spaces', zh: '空间', ar: 'المساحات' },
  talents: { fr: 'talents', en: 'talents', es: 'talentos', it: 'talenti', de: 'Talente', zh: '人才', ar: 'المواهب' },
  organizations: { fr: 'organisations', en: 'organizations', es: 'organizaciones', it: 'organizzazioni', de: 'Organisationen', zh: '组织', ar: 'المنظمات' },
};

const INTENT_LABELS: Record<string, LocalizedLabel> = {
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

function labelFor(labels: LocalizedLabel | undefined, language: SupportedLanguage): string | undefined {
  return labels?.[language] || (language === 'en' ? labels?.en : undefined);
}

function getSummaryTranslations(language: SupportedLanguage) {
  const translations = {
    en: {
      error: 'Error',
      actionNotDone: 'Action not completed',
      unknownError: 'Unknown error',
      noResult: 'No results',
      dataLoaded: 'Data loaded',
      element: (count: number) => `${count} item${count > 1 ? 's' : ''}`,
      result: (count: number) => `${count} result${count > 1 ? 's' : ''}`,
      video: (count: number) => `${count} video${count > 1 ? 's' : ''} found`,
      noVideo: 'No videos',
      generatedDocument: 'Document generated',
      saved: 'saved',
      generatedImage: 'Image generated',
      generatedDiagram: 'Diagram generated',
      noWebSource: 'No reliable sources found',
      webDone: 'Web search complete',
      extractionUnavailable: 'Extraction unavailable',
      degradedRead: 'Read (degraded mode)',
      degradedMode: 'degraded mode',
      documentRead: 'Document read',
      read: 'Read',
      referential: 'Catalog',
      catalogSearch: 'Catalog search',
      graph: 'Skill graph',
      learningPath: 'Learning path',
      alreadyKnown: 'already known',
      missingSkills: (count: number) => `${count} missing skill${count > 1 ? 's' : ''}`,
      skill: 'Skill',
      skillUpdated: 'Skill updated',
      actionDone: 'Action completed',
      done: 'Done',
    },
    fr: {
      error: 'Erreur',
      actionNotDone: 'Action non réalisée',
      unknownError: 'Erreur inconnue',
      noResult: 'Aucun résultat',
      dataLoaded: 'Données chargées',
      element: (count: number) => `${count} élément${count > 1 ? 's' : ''}`,
      result: (count: number) => `${count} résultat${count > 1 ? 's' : ''}`,
      video: (count: number) => `${count} vidéo${count > 1 ? 's' : ''} trouvée${count > 1 ? 's' : ''}`,
      noVideo: 'Aucune vidéo',
      generatedDocument: 'Document généré',
      saved: 'sauvegardé',
      generatedImage: 'Image générée',
      generatedDiagram: 'Diagramme généré',
      noWebSource: 'Aucune source fiable trouvée',
      webDone: 'Recherche web terminée',
      extractionUnavailable: 'Extraction indisponible',
      degradedRead: 'Lu (mode dégradé)',
      degradedMode: 'mode dégradé',
      documentRead: 'Document lu',
      read: 'Lu',
      referential: 'Référentiel',
      catalogSearch: 'Recherche référentiel',
      graph: 'Graphe compétences',
      learningPath: 'Parcours',
      alreadyKnown: 'déjà acquis',
      missingSkills: (count: number) => `${count} compétence${count > 1 ? 's' : ''} à acquérir`,
      skill: 'Compétence',
      skillUpdated: 'Compétence mise à jour',
      actionDone: 'Action effectuée',
      done: 'Terminé',
    },
    es: {
      error: 'Error',
      actionNotDone: 'Acción no completada',
      unknownError: 'Error desconocido',
      noResult: 'Sin resultados',
      dataLoaded: 'Datos cargados',
      element: (count: number) => `${count} elemento${count > 1 ? 's' : ''}`,
      result: (count: number) => `${count} resultado${count > 1 ? 's' : ''}`,
      video: (count: number) => `${count} vídeo${count > 1 ? 's' : ''} encontrado${count > 1 ? 's' : ''}`,
      noVideo: 'Sin vídeos',
      generatedDocument: 'Documento generado',
      saved: 'guardado',
      generatedImage: 'Imagen generada',
      generatedDiagram: 'Diagrama generado',
      noWebSource: 'No se encontraron fuentes fiables',
      webDone: 'Búsqueda web completada',
      extractionUnavailable: 'Extracción no disponible',
      degradedRead: 'Leído (modo degradado)',
      degradedMode: 'modo degradado',
      documentRead: 'Documento leído',
      read: 'Leído',
      referential: 'Catálogo',
      catalogSearch: 'Búsqueda en catálogo',
      graph: 'Grafo de competencias',
      learningPath: 'Ruta de aprendizaje',
      alreadyKnown: 'ya adquirido',
      missingSkills: (count: number) => `${count} competencia${count > 1 ? 's' : ''} por adquirir`,
      skill: 'Competencia',
      skillUpdated: 'Competencia actualizada',
      actionDone: 'Acción completada',
      done: 'Completado',
    },
    it: {
      error: 'Errore',
      actionNotDone: 'Azione non completata',
      unknownError: 'Errore sconosciuto',
      noResult: 'Nessun risultato',
      dataLoaded: 'Dati caricati',
      element: (count: number) => `${count} elemento${count > 1 ? 'i' : ''}`,
      result: (count: number) => `${count} risultato${count > 1 ? 'i' : ''}`,
      video: (count: number) => `${count} video trovato${count > 1 ? 'i' : ''}`,
      noVideo: 'Nessun video',
      generatedDocument: 'Documento generato',
      saved: 'salvato',
      generatedImage: 'Immagine generata',
      generatedDiagram: 'Diagramma generato',
      noWebSource: 'Nessuna fonte affidabile trovata',
      webDone: 'Ricerca web completata',
      extractionUnavailable: 'Estrazione non disponibile',
      degradedRead: 'Letto (modalità degradata)',
      degradedMode: 'modalità degradata',
      documentRead: 'Documento letto',
      read: 'Letto',
      referential: 'Catalogo',
      catalogSearch: 'Ricerca catalogo',
      graph: 'Grafo competenze',
      learningPath: 'Percorso',
      alreadyKnown: 'già acquisita',
      missingSkills: (count: number) => `${count} competenza${count > 1 ? 'e' : ''} da acquisire`,
      skill: 'Competenza',
      skillUpdated: 'Competenza aggiornata',
      actionDone: 'Azione completata',
      done: 'Completato',
    },
    de: {
      error: 'Fehler',
      actionNotDone: 'Aktion nicht abgeschlossen',
      unknownError: 'Unbekannter Fehler',
      noResult: 'Keine Ergebnisse',
      dataLoaded: 'Daten geladen',
      element: (count: number) => `${count} Element${count > 1 ? 'e' : ''}`,
      result: (count: number) => `${count} Ergebnis${count > 1 ? 'se' : ''}`,
      video: (count: number) => `${count} Video${count > 1 ? 's' : ''} gefunden`,
      noVideo: 'Keine Videos',
      generatedDocument: 'Dokument erstellt',
      saved: 'gespeichert',
      generatedImage: 'Bild erstellt',
      generatedDiagram: 'Diagramm erstellt',
      noWebSource: 'Keine verlässlichen Quellen gefunden',
      webDone: 'Websuche abgeschlossen',
      extractionUnavailable: 'Extraktion nicht verfügbar',
      degradedRead: 'Gelesen (eingeschränkter Modus)',
      degradedMode: 'eingeschränkter Modus',
      documentRead: 'Dokument gelesen',
      read: 'Gelesen',
      referential: 'Katalog',
      catalogSearch: 'Katalogsuche',
      graph: 'Kompetenzgraph',
      learningPath: 'Lernpfad',
      alreadyKnown: 'bereits erworben',
      missingSkills: (count: number) => `${count} fehlende Kompetenz${count > 1 ? 'en' : ''}`,
      skill: 'Kompetenz',
      skillUpdated: 'Kompetenz aktualisiert',
      actionDone: 'Aktion abgeschlossen',
      done: 'Fertig',
    },
    zh: {
      error: '错误',
      actionNotDone: '操作未完成',
      unknownError: '未知错误',
      noResult: '没有结果',
      dataLoaded: '数据已加载',
      element: (count: number) => `${count} 项`,
      result: (count: number) => `${count} 个结果`,
      video: (count: number) => `找到 ${count} 个视频`,
      noVideo: '没有视频',
      generatedDocument: '文档已生成',
      saved: '已保存',
      generatedImage: '图片已生成',
      generatedDiagram: '图表已生成',
      noWebSource: '未找到可靠来源',
      webDone: '网页搜索完成',
      extractionUnavailable: '无法提取',
      degradedRead: '已读取（降级模式）',
      degradedMode: '降级模式',
      documentRead: '文档已读取',
      read: '已读取',
      referential: '目录',
      catalogSearch: '目录搜索',
      graph: '技能图谱',
      learningPath: '学习路径',
      alreadyKnown: '已掌握',
      missingSkills: (count: number) => `${count} 项待掌握技能`,
      skill: '技能',
      skillUpdated: '技能已更新',
      actionDone: '操作已完成',
      done: '完成',
    },
    ar: {
      error: 'خطأ',
      actionNotDone: 'لم يكتمل الإجراء',
      unknownError: 'خطأ غير معروف',
      noResult: 'لا توجد نتائج',
      dataLoaded: 'تم تحميل البيانات',
      element: (count: number) => `${count} عنصر`,
      result: (count: number) => `${count} نتيجة`,
      video: (count: number) => `تم العثور على ${count} فيديو`,
      noVideo: 'لا توجد فيديوهات',
      generatedDocument: 'تم إنشاء المستند',
      saved: 'محفوظ',
      generatedImage: 'تم إنشاء الصورة',
      generatedDiagram: 'تم إنشاء المخطط',
      noWebSource: 'لم يتم العثور على مصادر موثوقة',
      webDone: 'اكتمل بحث الويب',
      extractionUnavailable: 'الاستخراج غير متاح',
      degradedRead: 'تمت القراءة (وضع محدود)',
      degradedMode: 'وضع محدود',
      documentRead: 'تمت قراءة المستند',
      read: 'تمت القراءة',
      referential: 'الفهرس',
      catalogSearch: 'بحث في الفهرس',
      graph: 'مخطط المهارات',
      learningPath: 'مسار التعلم',
      alreadyKnown: 'مكتسبة مسبقاً',
      missingSkills: (count: number) => `${count} مهارة مطلوبة`,
      skill: 'مهارة',
      skillUpdated: 'تم تحديث المهارة',
      actionDone: 'تم الإجراء',
      done: 'تم',
    },
  } satisfies Record<SupportedLanguage, Record<string, string | ((count: number) => string)>>;

  return translations[language] || translations.en;
}

export function generateToolSummary(
  toolName: string,
  output: unknown,
  isError: boolean,
  args?: Record<string, unknown>,
  language: SupportedLanguage = 'en'
): string {
  const tr = getSummaryTranslations(language);
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
        const typeLabel = entity ? labelFor(NAMESPACE_LABELS[entity], language) || '' : '';
        const countText = count > 0 ? tr.result(count) : tr.noResult;
        return typeLabel ? `${countText} · ${typeLabel}` : countText;
      }

      case 'sql_query': {
        const intent = args?.intent as string | undefined;
        const intentLabel = intent ? labelFor(INTENT_LABELS[intent], language) || '' : '';
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
          return docTitle ? `${tr.degradedRead} · ${String(docTitle).slice(0, 60)}` : `${tr.documentRead} (${tr.degradedMode})`;
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

      case 'learning_path': {
        const name = outputObj?.competency?.name as string | undefined;
        const target = (args?.target || args?.query || args?.goal) as string | undefined;
        const missingCount = outputObj?.summary?.missing_count as number | undefined;
        const alreadyKnown = outputObj?.summary?.already_known as boolean | undefined;
        const label = name || target;
        const status = alreadyKnown
          ? tr.alreadyKnown
          : typeof missingCount === 'number'
            ? tr.missingSkills(missingCount)
            : '';
        return [tr.learningPath, label, status].filter(Boolean).join(' · ');
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
        const actionLabels: Record<string, LocalizedLabel> = {
          apply_opportunity: { fr: 'Candidature soumise', en: 'Application submitted', es: 'Candidatura enviada', it: 'Candidatura inviata', de: 'Bewerbung gesendet', zh: '申请已提交', ar: 'تم إرسال الطلب' },
          join_community: { fr: 'Communauté rejointe', en: 'Community joined', es: 'Comunidad unida', it: 'Community raggiunta', de: 'Community beigetreten', zh: '已加入社区', ar: 'تم الانضمام إلى المجتمع' },
          book_space: { fr: 'Espace réservé', en: 'Space booked', es: 'Espacio reservado', it: 'Spazio prenotato', de: 'Space gebucht', zh: '空间已预订', ar: 'تم حجز المساحة' },
          accept_invitation: { fr: 'Invitation acceptée', en: 'Invitation accepted', es: 'Invitación aceptada', it: 'Invito accettato', de: 'Einladung angenommen', zh: '邀请已接受', ar: 'تم قبول الدعوة' },
          decline_invitation: { fr: 'Invitation déclinée', en: 'Invitation declined', es: 'Invitación rechazada', it: 'Invito rifiutato', de: 'Einladung abgelehnt', zh: '邀请已拒绝', ar: 'تم رفض الدعوة' },
          create_agenda_trigger: { fr: 'Rappel créé', en: 'Reminder created', es: 'Recordatorio creado', it: 'Promemoria creato', de: 'Erinnerung erstellt', zh: '提醒已创建', ar: 'تم إنشاء التذكير' },
          update_agenda_trigger: { fr: 'Rappel mis à jour', en: 'Reminder updated', es: 'Recordatorio actualizado', it: 'Promemoria aggiornato', de: 'Erinnerung aktualisiert', zh: '提醒已更新', ar: 'تم تحديث التذكير' },
        };
        return action ? labelFor(actionLabels[action], language) || tr.actionDone : tr.actionDone;
      }

      default:
        return tr.done;
    }
  } catch {
    return tr.done;
  }
}
