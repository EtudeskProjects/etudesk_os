/** Couleurs des types de relation du référentiel (prérequis / mène-vers /
 *  voisines / associées). Source unique partagée par le canvas (SkillsMap) et le
 *  panneau de détail (DigitalSkillsView) - valeurs hex car rendues hors CSS. */

export type RelationKind = 'pre' | 'leads' | 'sib' | 'rel';

export const RELATION_COLORS: Record<RelationKind, { light: string; dark: string }> = {
  pre: { light: '#2563EB', dark: '#60A5FA' },
  leads: { light: '#2563EB', dark: '#60A5FA' },
  sib: { light: '#16A34A', dark: '#4ADE80' },
  rel: { light: '#D97706', dark: '#FBBF24' },
};
