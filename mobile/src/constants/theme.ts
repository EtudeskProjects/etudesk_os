/**
 * ETUDESK DESIGN SYSTEM
 *
 * Philosophy: Ultra-moderne, minimaliste, luxe africain
 * - NO shadows
 * - NO gradients
 * - NO violet/purple colors
 * - NO obvious/popular colors
 *
 * Typography: Montserrat (primary brand font, shared with web)
 * Icons: Lucide React Native only
 *
 * Brand: Warm luxury, African elegance, clarity, engagement, community
 */

// --- Color Palette - Luxe Africain ---

/**
 * Primary: Rich Brown (#3B2416) - Luxe African warmth
 * Success: Forest Pale Green - Natural, understated
 * Warning: Warm Amber - Earth tones
 * Error: Terracotta - Warm red, not aggressive
 * Info: Warm Taupe - Neutral information
 */

export const LIGHT_COLORS = {
  // PRIMARY - Marron Luxe
  primary: '#3B2416',           // Main brand color - Rich brown
  primaryLight: '#5C3D2E',      // Lighter variant
  primaryDark: '#2A1A10',       // Darker variant
  primaryMuted: '#8B7355',      // Muted/soft variant

  // NEUTRALS - Warm Gray Scale
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

  // SEMANTIC - Earth Tones
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

  // BACKGROUNDS & SURFACES
  background: '#FFFFFF',        // Main app background
  backgroundSecondary: '#FAF9F7', // Secondary surfaces
  backgroundTertiary: '#F5F3F0', // Cards on secondary bg
  surface: '#FFFFFF',           // Card surfaces
  surfaceElevated: '#FAF9F7',   // Elevated cards

  // TEXT
  textPrimary: '#1F1C18',       // Main text
  textSecondary: '#6E675C',     // Secondary text
  textTertiary: '#918A7E',      // Tertiary/hint text
  textDisabled: '#B8B2A8',      // Disabled text
  textInverse: '#FFFFFF',       // Text on dark backgrounds
  textOnPrimary: '#FFFFFF',     // Text on primary color

  // BORDERS & DIVIDERS
  borderColor: '#EBE8E4',       // Default border
  borderColorStrong: '#D9D5CF', // Emphasized border
  divider: '#EBE8E4',           // Horizontal dividers

  // QUICK ACCESS CARDS - Harmonized Palette
  // Each card type has a cohesive color set
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

  // INTERACTIVE STATES
  overlay: 'rgba(26, 26, 26, 0.5)',      // Modal overlay
  overlayLight: 'rgba(26, 26, 26, 0.3)', // Light overlay
  pressed: 'rgba(59, 36, 22, 0.08)',     // Pressed state
  focused: 'rgba(59, 36, 22, 0.12)',     // Focus ring
  hover: 'rgba(59, 36, 22, 0.04)',       // Hover state

  // STATUS COLORS
  statusPending: '#A67C52',     // Warm amber
  statusActive: '#4A6741',      // Forest green
  statusRejected: '#8B4A3C',    // Terracotta
  statusSuspended: '#6B5E52',   // Taupe
  statusArchived: '#918A7E',    // Muted gray
} as const;

// Brand / partner colors (used for third-party identity, payments, etc.)
// Keep these centralized to avoid hardcoding values across the app.
export const BRAND_COLORS = {
  whatsapp: '#25D366',
  orangeMoney: '#FF6600',
  mtnMoney: '#FFCC00',
  moovMoney: '#0066CC',
  wave: '#1DC7EA',
  push: '#22C55E',
  djamo: '#6B4EFF',
} as const;

// UI palettes that should remain stable (not derived from theme mode).
export const TAG_COLOR_PALETTE = [
  '#6B5E52', // taupe
  '#4A6741', // forest green
  '#8B4A3C', // terracotta
  '#A67C52', // warm amber
  '#5E6B52', // olive
  '#6B525E', // mauve-brown
  '#52656B', // blue-gray
] as const;

// "Pure" colors for embedded WebViews / external content where theme inversion isn't desired.
export const STATIC_COLORS = {
  black: '#000000',
  white: '#ffffff',
} as const;

// DARK THEME
// Optimized for contrast and visibility
export const DARK_COLORS = {
  // Primary - LIGHTER for dark mode visibility (not the same dark brown)
  primary: '#C9A070',           // Warm gold-brown - visible on dark
  primaryLight: '#DDB88A',      // Lighter variant
  primaryDark: '#A68050',       // Darker variant
  primaryMuted: '#8B7355',      // Muted variant

  // Neutrals - Inverted warm scale with better contrast
  white: '#0D0B0A',             // Very dark for "white" elements
  black: '#F5F3F0',             // Light for "black" elements

  gray50: '#0D0B0A',            // Darkest - main background
  gray100: '#161412',           // Slightly lighter
  gray200: '#1E1C1A',           // Card backgrounds
  gray300: '#2A2826',           // Elevated surfaces
  gray400: '#3D3A36',           // Borders, dividers
  gray500: '#5C5850',           // Disabled elements
  gray600: '#8A847A',           // Tertiary text
  gray700: '#A8A29A',           // Secondary text
  gray800: '#D4D0CA',           // Primary text
  gray900: '#F5F3F0',           // Headings, emphasis

  // Semantic - MUCH lighter for dark mode visibility
  success: '#7CB870',           // Bright green
  successLight: '#1A2418',      // Dark green background
  successDark: '#5CA050',       // Pressed state

  error: '#E08070',             // Bright terracotta
  errorLight: '#2A1816',        // Dark red background
  errorDark: '#C86050',         // Pressed state

  warning: '#E8B870',           // Bright amber
  warningLight: '#2A2418',      // Dark amber background
  warningDark: '#C8A050',       // Pressed state

  info: '#A89888',              // Lighter taupe
  infoLight: '#1E1C1A',         // Dark taupe background
  infoDark: '#8A7868',          // Pressed state

  // Backgrounds & Surfaces
  background: '#0D0B0A',        // Very dark background
  backgroundSecondary: '#121110', // Slightly lighter
  backgroundTertiary: '#1A1816',  // Card background level
  surface: '#1E1C1A',           // Cards on dark bg
  surfaceElevated: '#2A2826',   // Elevated cards, modals

  // Text - High contrast on dark backgrounds
  textPrimary: '#F5F3F0',       // Primary text - very light
  textSecondary: '#B8B2A8',     // Secondary text - still readable
  textTertiary: '#8A847A',      // Tertiary/hint text
  textDisabled: '#5C5850',      // Disabled text
  textInverse: '#0D0B0A',       // Text on light backgrounds
  textOnPrimary: '#0D0B0A',     // Dark text on primary (now light primary)

  // Borders & Dividers - Subtle but visible
  borderColor: '#2A2826',       // Default border
  borderColorStrong: '#3D3A36', // Emphasized border
  divider: '#2A2826',           // Horizontal dividers

  // Quick Access Cards - Dark variants with BRIGHT accents for badges
  cardTalent: '#1E1C1A',
  cardTalentAccent: '#C9A070',    // Bright warm gold (same as primary)
  cardTalentText: '#E8DED0',

  cardOrg: '#1E1C1A',
  cardOrgAccent: '#B89878',       // Bright warm brown
  cardOrgText: '#E0D0C0',

  cardOpportunity: '#1E1C1A',
  cardOpportunityAccent: '#D4B896', // Bright sand
  cardOpportunityText: '#E8E0D0',

  cardCommunity: '#1A1C18',
  cardCommunityAccent: '#7CB870',  // Bright green (same as success)
  cardCommunityText: '#D8E8C8',

  cardSpace: '#1C1A18',
  cardSpaceAccent: '#A89888',      // Bright warm gray
  cardSpaceText: '#E0DCD8',

  // Interactive States - Using lighter primary for visibility
  overlay: 'rgba(0, 0, 0, 0.85)',
  overlayLight: 'rgba(0, 0, 0, 0.6)',
  pressed: 'rgba(201, 160, 112, 0.20)',   // Light primary with opacity
  focused: 'rgba(201, 160, 112, 0.30)',
  hover: 'rgba(201, 160, 112, 0.12)',

  // Status Colors - Bright for dark mode
  statusPending: '#E8B870',     // Bright amber
  statusActive: '#7CB870',      // Bright green
  statusRejected: '#E08070',    // Bright terracotta
  statusSuspended: '#A89888',   // Lighter taupe
  statusArchived: '#5C5850',    // Muted gray
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
// Consistent 4px grid for all spacing
export const SPACING = {
  // Base unit: 4px
  xxs: 2,       // 2px - Micro spacing (icon gaps)
  xs: 4,        // 4px - Tight spacing
  sm: 8,        // 8px - Compact spacing
  md: 16,       // 16px - Default spacing
  lg: 24,       // 24px - Comfortable spacing
  xl: 32,       // 32px - Generous spacing
  xxl: 40,      // 40px - Section spacing
  xxxl: 48,     // 48px - Large section spacing
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
    paddingVertical: SPACING.xs,              // 4px
    paddingHorizontal: 10,                    // 10px
    borderRadius: BORDER.radius.full,         // 9999 (pill shape)
    gap: SPACING.xs,                          // 4px (icon-to-text)
    fontSize: TYPOGRAPHY.fontSize.xs,         // 12px
    fontWeight: TYPOGRAPHY.fontWeight.medium,  // '500'
    iconSize: ICON.size.xxs,                  // 12px
    iconStrokeWidth: 2,                       // slightly thicker for 12px
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
// Uses Luxe Africain semantic colors
export const MATCH_COLORS = {
  excellent: {
    color: LIGHT_COLORS.success,           // #4A6741 - Forest green
    bgColor: LIGHT_COLORS.successLight,    // #E8EFE6
  },
  good: {
    color: LIGHT_COLORS.primaryMuted,      // #8B7355 - Muted brown
    bgColor: 'rgba(139, 115, 85, 0.08)',
  },
  average: {
    color: LIGHT_COLORS.warning,           // #A67C52 - Warm amber
    bgColor: LIGHT_COLORS.warningLight,    // #F7F0E8
  },
  low: {
    color: LIGHT_COLORS.error,             // #8B4A3C - Terracotta
    bgColor: LIGHT_COLORS.errorLight,      // #F5EBE8
  },
} as const;
