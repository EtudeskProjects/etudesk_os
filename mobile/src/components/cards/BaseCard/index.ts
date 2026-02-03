/**
 * BaseCard - Modular Card System
 *
 * Usage:
 * - BaseCard: Full featured card component for simple use cases
 * - CardContainer: Base wrapper for custom card layouts
 * - CardImage: Image section with placeholder
 * - CardBadgeRow: Positioned badge container
 * - CardContent: Content wrapper with standard padding
 * - CardHeader: Title + subtitle + actions row
 * - CardMetaRow: Meta items row (icons + text)
 */

export { BaseCard } from './BaseCard';
export * from './types';

// Re-export composable components
export { CardContainer } from './CardContainer';
export { CardImage } from './CardImage';
export { CardBadgeRow, CardBadge } from './CardBadge';
export { CardContent } from './CardContent';
export { CardHeader } from './CardHeader';
export { CardMetaRow } from './CardMetaRow';
export type { MetaItem } from './CardMetaRow';
