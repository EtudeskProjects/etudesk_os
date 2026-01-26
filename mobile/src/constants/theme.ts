// Etudesk Design System
// Ultra-moderne, minimaliste, sans shadow, sans gradient, sans border-radius

// Light Theme Colors
export const LIGHT_COLORS = {
  // Primary
  primary: '#26449F',
  primaryLight: '#3a5bc7',
  primaryDark: '#1a3280',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',

  // Semantic
  success: '#2E7D32',
  error: '#C62828',
  warning: '#F57C00',
  info: '#1565C0',
  red500: '#EF4444',

  // Background
  background: '#FFFFFF',
  backgroundSecondary: '#FAFAFA',
  surface: '#FFFFFF',

  // Text
  textPrimary: '#212121',
  textSecondary: '#757575',
  textDisabled: '#BDBDBD',

  // Border
  borderColor: '#E0E0E0',
} as const;

// Dark Theme Colors
export const DARK_COLORS = {
  // Primary (même bleu que le light mode)
  primary: '#26449F',
  primaryLight: '#3a5bc7',
  primaryDark: '#1a3280',

  // Neutrals inversés
  white: '#121212',
  black: '#FFFFFF',
  gray50: '#1a1a1a',
  gray100: '#212121',
  gray200: '#2d2d2d',
  gray300: '#3d3d3d',
  gray400: '#5c5c5c',
  gray500: '#7a7a7a',
  gray600: '#9e9e9e',
  gray700: '#b3b3b3',
  gray800: '#cfcfcf',
  gray900: '#e8e8e8',

  // Semantic (légèrement ajustés pour le dark mode)
  success: '#4CAF50',
  error: '#EF5350',
  warning: '#FFB74D',
  info: '#42A5F5',
  red500: '#EF4444',

  // Background
  background: '#121212',
  backgroundSecondary: '#1a1a1a',
  surface: '#1e1e1e',

  // Text
  textPrimary: '#e8e8e8',
  textSecondary: '#b3b3b3',
  textDisabled: '#5c5c5c',

  // Border
  borderColor: '#3d3d3d',
} as const;

// Default COLORS export (light mode for backwards compatibility)
export const COLORS = LIGHT_COLORS;

// Theme type
export type ThemeColors = typeof LIGHT_COLORS;
export type ThemeMode = 'light' | 'dark';

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const TYPOGRAPHY = {
  // Font Family - Montserrat
  fontFamily: {
    regular: 'Montserrat_400Regular',
    medium: 'Montserrat_500Medium',
    semibold: 'Montserrat_600SemiBold',
    bold: 'Montserrat_700Bold',
  },

  // Font Sizes (optimisés pour lisibilité mobile)
  fontSize: {
    xxs: 11,    // badges, catégories
    xs: 13,     // métadonnées, labels petits
    sm: 15,     // sous-titres, labels secondaires
    md: 17,     // texte de base, corps
    lg: 19,     // texte important
    xl: 22,     // sous-titres grands
    xxl: 28,    // titres de page
    xxxl: 36,   // grands titres
    display: 44, // splash, logo
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const ICON = {
  strokeWidth: 1.25,
  size: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },
} as const;

// Border radius harmonisé
export const BORDER = {
  radius: {
    none: 0,
    xs: 4,      // petits éléments, badges
    sm: 8,      // boutons, inputs, cards
    md: 12,     // blocs, modals
    lg: 16,     // grandes cards, images
    xl: 24,     // pills, tags arrondis
    full: 9999, // cercles parfaits
  },
  width: {
    thin: 1,
    medium: 2,
  },
} as const;



export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
} as const;

export const LAYOUT = {
  // Screen padding
  screenPadding: SPACING.lg,

  // Footer height
  footerHeight: 64,

  // Header height
  headerHeight: 56,

  // Input height
  inputHeight: 52,

  // Button height
  buttonHeight: 52,
} as const;
