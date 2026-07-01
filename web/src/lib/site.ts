/** Constantes globales du site vitrine Etudesk. */

export const IOS_URL = 'https://apps.apple.com/us/app/etudesk-os/id6761573837?pt=126968874&ct=website&mt=8';
export const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.etudesk.mobile&utm_source=etudesk_website&utm_medium=landing&utm_campaign=app_download';

export const SOCIALS = {
  facebook: 'https://www.facebook.com/etudesk',
  linkedin: 'https://www.linkedin.com/company/etudesk',
  x: 'https://x.com/etudesk',
  instagram: 'https://www.instagram.com/etudesk',
  youtube: 'https://www.youtube.com/@etudesk',
  tiktok: 'https://www.tiktok.com/@etudesk',
};

// href = ancre relative (sans langue) ; le prefixe de langue est ajoute au rendu.
// match = segment de route a comparer pour l'etat actif (sans langue).
export interface NavItem { href: string; fr: string; en: string; match?: string; }

export const NAV: NavItem[] = [
  { href: '#produit', fr: 'Etudesk OS', en: 'Etudesk OS' },
  { href: '#referentiel', fr: 'Référentiel Digital', en: 'Digital Referential', match: 'digital-skills' },
  { href: '#tarifs', fr: 'Tarifs', en: 'Pricing' },
  { href: '#qui-sommes-nous', fr: 'Qui sommes-nous', en: 'About' },
];
