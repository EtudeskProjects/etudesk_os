/**
 * ETUDESK DESIGN SYSTEM
 *
 * Philosophy: Noir & blanc, grand public, accessible, minimaliste, aéré.
 * - Canvas strictement monochrome (échelle de gris neutre + noir + blanc)
 * - La COULEUR ne sert qu'à porter du SENS :
 *     1. Les états sémantiques (succès / erreur / alerte / info)
 *     2. Les 5 TYPES de compétences (la signature visuelle de l'app)
 * - PLUS de marron / luxe africain / tons chauds nulle part
 * - NO shadows, NO gradients
 *
 * Règle de lecture : la couleur dit QUOI (type de compétence / état),
 * l'intensité (niveau de gris) dit COMBIEN (niveau de maîtrise).
 *
 * Typography: Montserrat (police de marque, partagée avec le web)
 * Icons: Lucide React Native only
 */

// --- Color Palette - Monochrome + sens ---

/**
 * Primary: Noir encre (#18181B) - autorité, neutralité, contraste max
 * Neutrals: échelle "zinc" froide et neutre (zéro sous-ton brun)
 * Sémantiques: vert / rouge / ambre / bleu modernes, lisibles (AA)
 * Compétences: 5 teintes joyau distinctes, une par TYPE de compétence
 */

export const LIGHT_COLORS = {
  // PRIMARY - Noir encre (remplace le marron)
  primary: '#18181B',           // Couleur de marque - noir encre
  primaryLight: '#3F3F46',      // Variante claire (graphite)
  primaryDark: '#09090B',       // Variante foncée (quasi noir)
  primaryMuted: '#71717A',      // Variante douce (gris moyen)

  // NEUTRALS - échelle zinc neutre
  white: '#FFFFFF',
  black: '#09090B',

  gray50: '#FAFAFA',            // Le plus clair - fonds
  gray100: '#F4F4F5',           // Cartes, surfaces
  gray200: '#E4E4E7',           // Bordures, séparateurs
  gray300: '#D4D4D8',           // Fonds désactivés
  gray400: '#A1A1AA',           // Placeholders
  gray500: '#71717A',           // Texte secondaire
  gray600: '#52525B',           // Icônes inactives
  gray700: '#3F3F46',           // Texte de corps secondaire
  gray800: '#27272A',           // Texte de corps principal
  gray900: '#18181B',           // Titres

  // SEMANTIC - couleurs d'état, propres et modernes
  success: '#16A34A',           // Vert
  successLight: '#DCFCE7',      // Fond succès
  successDark: '#15803D',       // Succès pressé

  error: '#DC2626',             // Rouge
  errorLight: '#FEE2E2',        // Fond erreur
  errorDark: '#B91C1C',         // Erreur pressée

  warning: '#D97706',           // Ambre
  warningLight: '#FEF3C7',      // Fond alerte
  warningDark: '#B45309',       // Alerte pressée

  info: '#2563EB',              // Bleu
  infoLight: '#DBEAFE',         // Fond info
  infoDark: '#1D4ED8',          // Info pressée

  // BACKGROUNDS & SURFACES
  background: '#FFFFFF',        // Fond principal de l'app
  backgroundSecondary: '#FAFAFA', // Surfaces secondaires
  backgroundTertiary: '#F4F4F5', // Cartes sur fond secondaire
  surface: '#FFFFFF',           // Surface de carte
  surfaceElevated: '#FAFAFA',   // Carte surélevée

  // TEXT
  textPrimary: '#18181B',       // Texte principal
  textSecondary: '#52525B',     // Texte secondaire (contraste renforcé)
  textTertiary: '#71717A',      // Texte tertiaire / indice
  textDisabled: '#A1A1AA',      // Texte désactivé
  textInverse: '#FFFFFF',       // Texte sur fond foncé
  textOnPrimary: '#FFFFFF',     // Texte sur la couleur primaire

  // BORDERS & DIVIDERS
  borderColor: '#E4E4E7',       // Bordure par défaut
  borderColorStrong: '#D4D4D8', // Bordure accentuée
  divider: '#E4E4E7',           // Séparateurs horizontaux

  // ---- COMPÉTENCES : 5 TYPES = 5 teintes (la couleur "métier") ----
  // Une couleur stable par TYPE de compétence, lisible sur blanc (AA).
  // knowledge → bleu | hard_skill → cyan | soft_skill → rose
  // tool_platform → violet | language → émeraude
  skillKnowledge: '#1D4ED8',       // Connaissance
  skillKnowledgeBg: '#EAF1FE',
  skillHardSkill: '#0E7490',       // Compétence technique
  skillHardSkillBg: '#E4F5F9',
  skillSoftSkill: '#BE185D',       // Compétence comportementale
  skillSoftSkillBg: '#FCE9F1',
  skillToolPlatform: '#6D28D9',    // Outil / plateforme
  skillToolPlatformBg: '#F1EAFD',
  skillLanguage: '#047857',        // Langue
  skillLanguageBg: '#E3F4ED',

  // QUICK ACCESS CARDS - neutres (la couleur est réservée aux compétences)
  // On différencie les types d'entité par l'icône, pas par la couleur.
  cardTalent: '#FAFAFA',
  cardTalentAccent: '#18181B',
  cardTalentText: '#18181B',

  cardOrg: '#FAFAFA',
  cardOrgAccent: '#18181B',
  cardOrgText: '#18181B',

  cardOpportunity: '#FAFAFA',
  cardOpportunityAccent: '#18181B',
  cardOpportunityText: '#18181B',

  cardCommunity: '#FAFAFA',
  cardCommunityAccent: '#18181B',
  cardCommunityText: '#18181B',

  cardSpace: '#FAFAFA',
  cardSpaceAccent: '#18181B',
  cardSpaceText: '#18181B',

  // INTERACTIVE STATES (base noire)
  overlay: 'rgba(9, 9, 11, 0.5)',       // Overlay de modale
  overlayLight: 'rgba(9, 9, 11, 0.3)',  // Overlay léger
  pressed: 'rgba(9, 9, 11, 0.06)',      // État pressé
  focused: 'rgba(9, 9, 11, 0.10)',      // Anneau de focus
  hover: 'rgba(9, 9, 11, 0.04)',        // État survol

  // STATUS COLORS (alignées sur les sémantiques)
  statusPending: '#D97706',     // Ambre
  statusActive: '#16A34A',      // Vert
  statusRejected: '#DC2626',    // Rouge
  statusSuspended: '#2563EB',   // Bleu
  statusArchived: '#71717A',    // Gris
} as const;

// Brand / partner colors (used for third-party identity, payments, etc.)
// Keep these centralized to avoid hardcoding values across the app.
export const BRAND_COLORS = {
  orangeMoney: '#FF6600',
  mtnMoney: '#FFCC00',
  moovMoney: '#0066CC',
  wave: '#1DC7EA',
  push: '#22C55E',
  djamo: '#6B4EFF',
} as const;

// UI palettes that should remain stable (not derived from theme mode).
// Categorical palette (graphes, tags génériques) — aligné sur la palette compétences.
export const TAG_COLOR_PALETTE = [
  '#1D4ED8', // bleu
  '#0E7490', // cyan
  '#BE185D', // rose
  '#6D28D9', // violet
  '#047857', // émeraude
  '#D97706', // ambre
  '#52525B', // graphite
] as const;

// "Pure" colors for embedded WebViews / external content where theme inversion isn't desired.
export const STATIC_COLORS = {
  black: '#000000',
  white: '#ffffff',
} as const;

// DARK THEME
// Même logique : canvas monochrome (zinc inversé), couleur = sens.
export const DARK_COLORS = {
  // Primary - clair sur fond sombre (le "noir" devient blanc en dark)
  primary: '#FAFAFA',
  primaryLight: '#FFFFFF',
  primaryDark: '#D4D4D8',
  primaryMuted: '#A1A1AA',

  // Neutrals - échelle zinc inversée
  white: '#09090B',             // "blanc" = surface très sombre
  black: '#FAFAFA',             // "noir" = quasi blanc

  gray50: '#09090B',            // Fond principal
  gray100: '#18181B',           // Légèrement plus clair
  gray200: '#27272A',           // Fonds de cartes
  gray300: '#3F3F46',           // Surfaces surélevées
  gray400: '#52525B',           // Bordures, séparateurs
  gray500: '#71717A',           // Éléments désactivés
  gray600: '#A1A1AA',           // Texte tertiaire
  gray700: '#D4D4D8',           // Texte secondaire
  gray800: '#E4E4E7',           // Texte principal
  gray900: '#FAFAFA',           // Titres, emphase

  // Semantic - variantes plus claires pour le mode sombre
  success: '#4ADE80',
  successLight: '#14271B',
  successDark: '#22C55E',

  error: '#F87171',
  errorLight: '#2A1515',
  errorDark: '#EF4444',

  warning: '#FBBF24',
  warningLight: '#271E0E',
  warningDark: '#F59E0B',

  info: '#60A5FA',
  infoLight: '#0F2038',
  infoDark: '#3B82F6',

  // Backgrounds & Surfaces
  background: '#09090B',
  backgroundSecondary: '#0F0F11',
  backgroundTertiary: '#18181B',
  surface: '#18181B',
  surfaceElevated: '#27272A',

  // Text - haut contraste sur fond sombre
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textTertiary: '#71717A',
  textDisabled: '#52525B',
  textInverse: '#09090B',
  textOnPrimary: '#09090B',     // texte sombre sur primaire clair

  // Borders & Dividers
  borderColor: '#27272A',
  borderColorStrong: '#3F3F46',
  divider: '#27272A',

  // Compétences - 5 teintes plus claires (lisibles sur fond sombre)
  skillKnowledge: '#60A5FA',
  skillKnowledgeBg: '#11233F',
  skillHardSkill: '#22D3EE',
  skillHardSkillBg: '#0C2A30',
  skillSoftSkill: '#F472B6',
  skillSoftSkillBg: '#311321',
  skillToolPlatform: '#A78BFA',
  skillToolPlatformBg: '#221A38',
  skillLanguage: '#34D399',
  skillLanguageBg: '#0E2A20',

  // Quick Access Cards - neutres
  cardTalent: '#18181B',
  cardTalentAccent: '#FAFAFA',
  cardTalentText: '#FAFAFA',

  cardOrg: '#18181B',
  cardOrgAccent: '#FAFAFA',
  cardOrgText: '#FAFAFA',

  cardOpportunity: '#18181B',
  cardOpportunityAccent: '#FAFAFA',
  cardOpportunityText: '#FAFAFA',

  cardCommunity: '#18181B',
  cardCommunityAccent: '#FAFAFA',
  cardCommunityText: '#FAFAFA',

  cardSpace: '#18181B',
  cardSpaceAccent: '#FAFAFA',
  cardSpaceText: '#FAFAFA',

  // Interactive States (base claire)
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  pressed: 'rgba(250, 250, 250, 0.08)',
  focused: 'rgba(250, 250, 250, 0.12)',
  hover: 'rgba(250, 250, 250, 0.05)',

  // Status Colors - variantes claires
  statusPending: '#FBBF24',
  statusActive: '#4ADE80',
  statusRejected: '#F87171',
  statusSuspended: '#60A5FA',
  statusArchived: '#71717A',
} as const;

// Default export for backwards compatibility
export const COLORS = LIGHT_COLORS;

// Type definitions
// Structural theme colors type (string values), so LIGHT/DARK palettes are compatible.
// Avoid using the literal `as const` value types here, otherwise DARK_COLORS won't be assignable.
type LightColorsShape = typeof LIGHT_COLORS;
export type ThemeColors = { readonly [K in keyof LightColorsShape]: string };
export type ThemeMode = 'light' | 'dark';

// SPACING SYSTEM
// Grille 4px. Les micro-tokens (xxs/xs/sm/md) restent stables car ils
// pilotent l'intérieur des composants (gaps icône-texte, paddings).
// Les tokens de SECTION (lg+) restent assez confortables tout en laissant
// davantage de largeur utile aux vues mobiles.
export const SPACING = {
  xxs: 2,       // 2px - Micro (gaps d'icônes)
  xs: 4,        // 4px - Très serré
  sm: 8,        // 8px - Compact
  md: 16,       // 16px - Défaut
  lg: 20,       // 20px - Confortable, optimisé mobile
  xl: 28,       // 28px - Généreux
  xxl: 48,      // 48px - Espacement de section
  xxxl: 64,     // 64px - Grande section
} as const;

// TYPOGRAPHY
// Brand font: Montserrat (shared between mobile + web).
// IMPORTANT: with custom fonts, weight is driven by the fontFamily (each weight
// is a separate file), NOT by `fontWeight`. The global Text patch in
// src/lib/applyDefaultFont.ts maps any `fontWeight` to the matching Montserrat
// family automatically, so legacy styles that only set `fontWeight` still render
// in the correct brand weight. Prefer the fontFamily tokens below for new code.
export const TYPOGRAPHY = {
  // Font Families
  fontFamily: {
    regular: 'Montserrat_400Regular',
    medium: 'Montserrat_500Medium',
    semibold: 'Montserrat_600SemiBold',
    bold: 'Montserrat_700Bold',

    // Alternative names for flexibility
    primary: 'Montserrat_400Regular',
    primaryMedium: 'Montserrat_500Medium',
    primaryBold: 'Montserrat_700Bold',

    // Display / headings
    display: 'Montserrat_600SemiBold',
    displayBold: 'Montserrat_700Bold',
  },

  // Font Sizes - échelle agrandie pour la lisibilité grand public (+1 à +4px)
  fontSize: {
    xxs: 11,      // Micro text, badges
    xs: 13,       // Captions, metadata
    sm: 15,       // Secondary text, labels
    md: 17,       // Body text (base)
    lg: 19,       // Emphasized body
    xl: 22,       // Subheadings
    xxl: 26,      // Section titles
    xxxl: 34,     // Page titles
    display: 44,  // Hero text
    displayLg: 52, // Splash screens
  },

  // Line Heights - Multipliers (un peu plus aérés)
  lineHeight: {
    none: 1,        // Single line (icons, badges)
    tight: 1.2,     // Headings
    snug: 1.35,     // Subheadings
    normal: 1.55,   // Body text
    relaxed: 1.7,   // Long-form text
    loose: 1.85,    // Spacious text
  },

  // Letter Spacing
  letterSpacing: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
    widest: 1,
  },

  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },
} as const;

// ICON SYSTEM
// Lucide React Native only
export const ICON = {
  // Stroke width - Consistent across all icons
  strokeWidth: 1.5,
  strokeWidthThin: 1.25,
  strokeWidthThick: 2,

  // Size scale
  size: {
    xxs: 12,      // Inline with small text
    xs: 14,       // Badges, chips
    sm: 16,       // Buttons small, list items
    md: 20,       // Default icon size
    lg: 24,       // Navigation, headers
    xl: 28,       // Featured icons
    xxl: 32,      // Large feature icons
    xxxl: 40,     // Hero icons
    display: 48,  // Splash, empty states
  },
} as const;

// BORDER SYSTEM
// Clean, minimal borders
export const BORDER = {
  // Border radius scale
  radius: {
    none: 0,
    xs: 4,        // Badges, chips
    sm: 8,        // Buttons, inputs
    md: 12,       // Cards, modals
    lg: 16,       // Large cards, images
    xl: 20,       // Featured cards
    xxl: 24,      // Pills, tags
    full: 9999,   // Perfect circles
  },

  // Border widths
  width: {
    none: 0,
    thin: 1,
    medium: 1.5,
    thick: 2,
  },
} as const;

// LAYOUT SYSTEM
// Consistent dimensions
export const LAYOUT = {
  // Screen padding
  screenPadding: SPACING.lg,    // 20px
  screenPaddingHorizontal: SPACING.lg,
  screenPaddingVertical: SPACING.md,

  // Component heights
  headerHeight: 56,
  footerHeight: 64,
  tabBarHeight: 56,

  // Input & Button heights (un peu plus hauts = touch + lisibilité)
  inputHeightSm: 44,
  inputHeight: 52,
  inputHeightLg: 58,

  buttonHeightSm: 40,
  buttonHeight: 48,
  buttonHeightLg: 56,

  // Card dimensions
  cardImageHeight: 160,
  cardImageHeightSm: 120,
  cardImageHeightLg: 200,

  // Avatar sizes
  avatarXs: 24,
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 48,
  avatarXl: 56,
  avatarXxl: 72,

  // FAB
  fabSize: 56,
  fabSizeSm: 48,

  // Modal
  modalMaxWidth: 400,
  modalBorderRadius: BORDER.radius.lg,

  // Bottom sheet
  bottomSheetHandleWidth: 40,
  bottomSheetHandleHeight: 4,
} as const;

// OPACITY SCALE
// For consistent transparency
export const OPACITY = {
  transparent: 0,
  5: 0.05,
  8: 0.08,
  10: 0.10,
  12: 0.12,
  15: 0.15,
  20: 0.20,
  25: 0.25,
  30: 0.30,
  40: 0.40,
  50: 0.50,
  60: 0.60,
  70: 0.70,
  80: 0.80,
  90: 0.90,
  100: 1,
} as const;

// Helper function to apply opacity to hex colors
export const withOpacity = (hexColor: string, opacity: number): string => {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// --- Animation For Future Use - No Shadows/Gradients ---

export const ANIMATION = {
  // Durations
  duration: {
    instant: 100,
    fast: 150,
    normal: 250,
    slow: 350,
    slower: 500,
  },

  // Easing curves
  easing: {
    linear: 'linear',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

// --- Z-Index Scale ---

export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  max: 100,
} as const;

// COMPONENT TOKENS
// Pre-defined component configurations
export const COMPONENT = {
  // Button variants
  button: {
    primary: {
      background: 'primary',
      text: 'textOnPrimary',
      border: 'transparent',
    },
    secondary: {
      background: 'gray100',
      text: 'textPrimary',
      border: 'transparent',
    },
    outline: {
      background: 'transparent',
      text: 'primary',
      border: 'primary',
    },
    ghost: {
      background: 'transparent',
      text: 'textPrimary',
      border: 'transparent',
    },
  },

  // Badge status colors
  badge: {
    pending: {
      background: 'warningLight',
      text: 'warning',
    },
    active: {
      background: 'successLight',
      text: 'success',
    },
    rejected: {
      background: 'errorLight',
      text: 'error',
    },
    suspended: {
      background: 'infoLight',
      text: 'info',
    },
    archived: {
      background: 'gray100',
      text: 'gray600',
    },
  },

  // Badge dimensions (for TabBar, notifications, etc.)
  badgeDimensions: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    fontSize: 11,
  },

  // Pill/Tag/Chip/Badge — single source of truth
  pill: {
    paddingVertical: 6,                       // 6px (un peu plus aéré)
    paddingHorizontal: 12,                    // 12px
    borderRadius: BORDER.radius.full,         // 9999 (pill shape)
    gap: SPACING.xs,                          // 4px (icon-to-text)
    fontSize: TYPOGRAPHY.fontSize.xs,         // 13px
    fontWeight: TYPOGRAPHY.fontWeight.medium,  // '500'
    iconSize: ICON.size.xs,                   // 14px
    iconStrokeWidth: 2,                       // slightly thicker for small sizes
  },

  // Toggle configurations
  toggle: {
    normal: {
      trackWidth: 48,
      trackHeight: 8,
      thumbSize: 28,
    },
    small: {
      trackWidth: 36,
      trackHeight: 6,
      thumbSize: 20,
    },
  },

  // TabBar configurations
  tabBar: {
    indicatorHeight: 2,
    indicatorBorderRadius: 1,
  },

  // Step indicator configurations
  stepIndicator: {
    size: 32,
    fontSize: 14,
  },

  // Image slider
  imageSlider: {
    defaultHeight: 200,
  },

  // Card configurations
  card: {
    padding: SPACING.md,
    gap: SPACING.sm,
    borderRadius: BORDER.radius.md,
  },

  // Input configurations
  input: {
    padding: SPACING.md,
    borderRadius: BORDER.radius.sm,
    borderWidth: BORDER.width.thin,
  },

  // Touch targets (accessibility)
  touchTarget: {
    minSize: 44,  // WCAG minimum
    recommended: 48,
  },
} as const;

// MATCH CATEGORY COLORS (for application matching scores)
// Sémantiques monochromes + couleur (vert → bleu → ambre → rouge)
export const MATCH_COLORS = {
  excellent: {
    color: LIGHT_COLORS.success,           // #16A34A - Vert
    bgColor: LIGHT_COLORS.successLight,    // #DCFCE7
  },
  good: {
    color: LIGHT_COLORS.info,              // #2563EB - Bleu
    bgColor: LIGHT_COLORS.infoLight,       // #DBEAFE
  },
  average: {
    color: LIGHT_COLORS.warning,           // #D97706 - Ambre
    bgColor: LIGHT_COLORS.warningLight,    // #FEF3C7
  },
  low: {
    color: LIGHT_COLORS.error,             // #DC2626 - Rouge
    bgColor: LIGHT_COLORS.errorLight,      // #FEE2E2
  },
} as const;
