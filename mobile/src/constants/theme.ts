/**
 * ETUDESK DESIGN SYSTEM
 *
 * Philosophy: Ultra-moderne, minimaliste, luxe africain
 * - NO shadows
 * - NO gradients
 * - NO violet/purple colors
 * - NO obvious/popular colors
 *
 * Typography: Satoshi (primary), Grotesques (secondary)
 * Icons: Lucide React Native only
 *
 * Brand: Warm luxury, African elegance, clarity, engagement, community
 */

// ═══════════════════════════════════════════════════════════════
// COLOR PALETTE - Luxe Africain
// ═══════════════════════════════════════════════════════════════

/**
 * Primary: Rich Brown (#3B2416) - Luxe African warmth
 * Success: Forest Pale Green - Natural, understated
 * Warning: Warm Amber - Earth tones
 * Error: Terracotta - Warm red, not aggressive
 * Info: Warm Taupe - Neutral information
 */

export const LIGHT_COLORS = {
  // ─────────────────────────────────────────────────────────────
  // PRIMARY - Marron Luxe
  // ─────────────────────────────────────────────────────────────
  primary: '#3B2416',           // Main brand color - Rich brown
  primaryLight: '#5C3D2E',      // Lighter variant
  primaryDark: '#2A1A10',       // Darker variant
  primaryMuted: '#8B7355',      // Muted/soft variant

  // ─────────────────────────────────────────────────────────────
  // NEUTRALS - Warm Gray Scale
  // ─────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#1A1A1A',

  // Warm grays (slight brown undertone for harmony)
  gray50: '#FAF9F7',            // Lightest - backgrounds
  gray100: '#F5F3F0',           // Cards, surfaces
  gray200: '#EBE8E4',           // Borders, dividers
  gray300: '#D9D5CF',           // Disabled backgrounds
  gray400: '#B8B2A8',           // Placeholders
  gray500: '#918A7E',           // Secondary text
  gray600: '#6E675C',           // Icons inactive
  gray700: '#4D4840',           // Body text secondary
  gray800: '#332F2A',           // Body text primary
  gray900: '#1F1C18',           // Headings

  // ─────────────────────────────────────────────────────────────
  // SEMANTIC - Earth Tones
  // ─────────────────────────────────────────────────────────────
  success: '#4A6741',           // Forest pale green
  successLight: '#E8EFE6',      // Success background
  successDark: '#3A5233',       // Success pressed

  error: '#8B4A3C',             // Terracotta
  errorLight: '#F5EBE8',        // Error background
  errorDark: '#6B3A2E',         // Error pressed

  warning: '#A67C52',           // Warm amber
  warningLight: '#F7F0E8',      // Warning background
  warningDark: '#866340',       // Warning pressed

  info: '#6B5E52',              // Warm taupe
  infoLight: '#F2EFEC',         // Info background
  infoDark: '#524940',          // Info pressed

  // ─────────────────────────────────────────────────────────────
  // BACKGROUNDS & SURFACES
  // ─────────────────────────────────────────────────────────────
  background: '#FFFFFF',        // Main app background
  backgroundSecondary: '#FAF9F7', // Secondary surfaces
  backgroundTertiary: '#F5F3F0', // Cards on secondary bg
  surface: '#FFFFFF',           // Card surfaces
  surfaceElevated: '#FAF9F7',   // Elevated cards

  // ─────────────────────────────────────────────────────────────
  // TEXT
  // ─────────────────────────────────────────────────────────────
  textPrimary: '#1F1C18',       // Main text
  textSecondary: '#6E675C',     // Secondary text
  textTertiary: '#918A7E',      // Tertiary/hint text
  textDisabled: '#B8B2A8',      // Disabled text
  textInverse: '#FFFFFF',       // Text on dark backgrounds
  textOnPrimary: '#FFFFFF',     // Text on primary color

  // ─────────────────────────────────────────────────────────────
  // BORDERS & DIVIDERS
  // ─────────────────────────────────────────────────────────────
  borderColor: '#EBE8E4',       // Default border
  borderColorStrong: '#D9D5CF', // Emphasized border
  divider: '#EBE8E4',           // Horizontal dividers

  // ─────────────────────────────────────────────────────────────
  // QUICK ACCESS CARDS - Harmonized Palette
  // Each card type has a cohesive color set
  // ─────────────────────────────────────────────────────────────

  // Talent Cards - Warm beige/cream
  cardTalent: '#F7F4F0',
  cardTalentAccent: '#D4C4B0',
  cardTalentText: '#5C4D3D',

  // Organization Cards - Soft terracotta
  cardOrg: '#F5EFEA',
  cardOrgAccent: '#C9B8A8',
  cardOrgText: '#5A4A3A',

  // Opportunity Cards - Warm sand
  cardOpportunity: '#F8F5F0',
  cardOpportunityAccent: '#D6CBBC',
  cardOpportunityText: '#5D5040',

  // Community Cards - Sage green
  cardCommunity: '#F2F5F0',
  cardCommunityAccent: '#C4D4B8',
  cardCommunityText: '#4A5A40',

  // Space Cards - Warm gray (used for bookable spaces)
  cardSpace: '#F5F4F2',
  cardSpaceAccent: '#D0CCC4',
  cardSpaceText: '#4D4840',

  // ─────────────────────────────────────────────────────────────
  // INTERACTIVE STATES
  // ─────────────────────────────────────────────────────────────
  overlay: 'rgba(26, 26, 26, 0.5)',      // Modal overlay
  overlayLight: 'rgba(26, 26, 26, 0.3)', // Light overlay
  pressed: 'rgba(59, 36, 22, 0.08)',     // Pressed state
  focused: 'rgba(59, 36, 22, 0.12)',     // Focus ring
  hover: 'rgba(59, 36, 22, 0.04)',       // Hover state

  // ─────────────────────────────────────────────────────────────
  // STATUS COLORS
  // ─────────────────────────────────────────────────────────────
  statusPending: '#A67C52',     // Warm amber
  statusActive: '#4A6741',      // Forest green
  statusRejected: '#8B4A3C',    // Terracotta
  statusSuspended: '#6B5E52',   // Taupe
  statusArchived: '#918A7E',    // Muted gray
} as const;

// ─────────────────────────────────────────────────────────────
// DARK THEME
// Same primary color, darker background
// ─────────────────────────────────────────────────────────────
export const DARK_COLORS = {
  // Primary - SAME as light mode for brand consistency
  primary: '#3B2416',           // Same rich brown as light mode
  primaryLight: '#5C3D2E',
  primaryDark: '#2A1A10',
  primaryMuted: '#8B7355',

  // Neutrals - Inverted warm scale
  white: '#0D0B0A',             // Very dark for "white" elements
  black: '#FAF9F7',

  gray50: '#121110',            // Darker background levels
  gray100: '#1A1816',
  gray200: '#242220',
  gray300: '#302D2A',
  gray400: '#4D4840',
  gray500: '#6E675C',
  gray600: '#918A7E',
  gray700: '#B8B2A8',
  gray800: '#D9D5CF',
  gray900: '#F5F3F0',

  // Semantic - Lighter for dark mode visibility
  success: '#6A9A60',
  successLight: '#1A241A',
  successDark: '#4A7A40',

  error: '#B87060',
  errorLight: '#241A18',
  errorDark: '#984848',

  warning: '#C9A070',
  warningLight: '#241E18',
  warningDark: '#A88050',

  info: '#908070',
  infoLight: '#1E1C1A',
  infoDark: '#706050',

  // Backgrounds & Surfaces - DARKER
  background: '#0D0B0A',        // Very dark background
  backgroundSecondary: '#121110',
  backgroundTertiary: '#1A1816',
  surface: '#1A1816',           // Cards on dark bg
  surfaceElevated: '#242220',

  // Text - High contrast on dark
  textPrimary: '#F5F3F0',
  textSecondary: '#B8B2A8',
  textTertiary: '#918A7E',
  textDisabled: '#6E675C',
  textInverse: '#0D0B0A',
  textOnPrimary: '#FFFFFF',     // White text on primary (dark primary)

  // Borders & Dividers
  borderColor: '#242220',
  borderColorStrong: '#302D2A',
  divider: '#242220',

  // Quick Access Cards - Dark variants
  cardTalent: '#1A1816',
  cardTalentAccent: '#3D3530',
  cardTalentText: '#D4C4B0',

  cardOrg: '#1A1816',
  cardOrgAccent: '#3A3230',
  cardOrgText: '#C9B8A8',

  cardOpportunity: '#1A1816',
  cardOpportunityAccent: '#3D3830',
  cardOpportunityText: '#D6CBBC',

  cardCommunity: '#181A16',
  cardCommunityAccent: '#303828',
  cardCommunityText: '#C4D4B8',

  cardSpace: '#1A1918',
  cardSpaceAccent: '#302D2A',
  cardSpaceText: '#D0CCC4',

  // Interactive States
  overlay: 'rgba(0, 0, 0, 0.8)',
  overlayLight: 'rgba(0, 0, 0, 0.6)',
  pressed: 'rgba(59, 36, 22, 0.30)',   // Same primary with opacity
  focused: 'rgba(59, 36, 22, 0.40)',
  hover: 'rgba(59, 36, 22, 0.20)',

  // Status Colors - Same as light but slightly adjusted
  statusPending: '#C9A070',
  statusActive: '#6A9A60',
  statusRejected: '#B87060',
  statusSuspended: '#908070',
  statusArchived: '#4D4840',
} as const;

// Default export for backwards compatibility
export const COLORS = LIGHT_COLORS;

// Type definitions
export type ThemeColors = typeof LIGHT_COLORS;
export type ThemeMode = 'light' | 'dark';

// ═══════════════════════════════════════════════════════════════
// SPACING SYSTEM
// Consistent 4px grid for all spacing
// ═══════════════════════════════════════════════════════════════

export const SPACING = {
  // Base unit: 4px
  xxs: 2,       // 2px - Micro spacing (icon gaps)
  xs: 4,        // 4px - Tight spacing
  sm: 8,        // 8px - Compact spacing
  md: 16,       // 16px - Default spacing
  lg: 24,       // 24px - Comfortable spacing
  xl: 32,       // 32px - Generous spacing
  xxl: 48,      // 48px - Section spacing
  xxxl: 64,     // 64px - Large section spacing
} as const;

// ═══════════════════════════════════════════════════════════════
// TYPOGRAPHY
// Primary: Satoshi | Secondary: Grotesques
// ═══════════════════════════════════════════════════════════════

export const TYPOGRAPHY = {
  // Font Families
  fontFamily: {
    // Satoshi - Primary font for UI
    regular: 'Satoshi-Regular',
    medium: 'Satoshi-Medium',
    semibold: 'Satoshi-Bold',      // Satoshi doesn't have semibold
    bold: 'Satoshi-Black',

    // Alternative names for flexibility
    primary: 'Satoshi-Regular',
    primaryMedium: 'Satoshi-Medium',
    primaryBold: 'Satoshi-Bold',

    // Grotesques - Secondary/Display font
    display: 'Grotesques-Regular',
    displayBold: 'Grotesques-Bold',
  },

  // Font Sizes - Harmonic scale
  fontSize: {
    xxs: 10,      // Micro text, badges
    xs: 12,       // Captions, metadata
    sm: 14,       // Secondary text, labels
    md: 16,       // Body text (base)
    lg: 18,       // Emphasized body
    xl: 20,       // Subheadings
    xxl: 24,      // Section titles
    xxxl: 32,     // Page titles
    display: 40,  // Hero text
    displayLg: 48, // Splash screens
  },

  // Line Heights - Multipliers
  lineHeight: {
    none: 1,        // Single line (icons, badges)
    tight: 1.2,     // Headings
    snug: 1.35,     // Subheadings
    normal: 1.5,    // Body text
    relaxed: 1.65,  // Long-form text
    loose: 1.8,     // Spacious text
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

// ═══════════════════════════════════════════════════════════════
// ICON SYSTEM
// Lucide React Native only
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// BORDER SYSTEM
// Clean, minimal borders
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// LAYOUT SYSTEM
// Consistent dimensions
// ═══════════════════════════════════════════════════════════════

export const LAYOUT = {
  // Screen padding
  screenPadding: SPACING.lg,    // 24px
  screenPaddingHorizontal: SPACING.lg,
  screenPaddingVertical: SPACING.md,

  // Component heights
  headerHeight: 56,
  footerHeight: 64,
  tabBarHeight: 56,

  // Input & Button heights
  inputHeightSm: 40,
  inputHeight: 48,
  inputHeightLg: 56,

  buttonHeightSm: 36,
  buttonHeight: 44,
  buttonHeightLg: 52,

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

// ═══════════════════════════════════════════════════════════════
// OPACITY SCALE
// For consistent transparency
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// ANIMATION (for future use - no shadows/gradients)
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// Z-INDEX SCALE
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// COMPONENT TOKENS
// Pre-defined component configurations
// ═══════════════════════════════════════════════════════════════

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
} as const;

