/**
 * Shared types for card components
 */

import { LucideIcon } from 'lucide-react-native';

export interface StatusOverlay {
  label: string;
  color: string;
  bgColor: string;
  icon?: React.ReactNode;
}

export interface Badge {
  label: string;
  backgroundColor: string;
  textColor: string;
  icon?: LucideIcon;
}

export interface MetaItem {
  icon: LucideIcon;
  text: string;
}

export interface CardAction {
  Icon: LucideIcon;
  color?: string;
  onPress: () => void;
  fill?: string;
  accessibilityLabel?: string;
}

export interface BaseCardProps {
  // Required
  onPress: () => void;

  // Image
  imageUrl?: string | null;
  placeholderIcon: LucideIcon;

  // Content
  title: string;
  subtitle?: string;
  description?: string;

  // Badges (top-left of image)
  badges?: Badge[];

  // Status overlay (top-right of image)
  statusOverlay?: StatusOverlay;

  // Meta items (bottom row)
  metaItems?: MetaItem[];

  // Actions (header row, right side)
  actions?: CardAction[];

  // Styling
  isLast?: boolean;
  primaryColor?: string;
}
