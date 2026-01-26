/**
 * Formats a number into a compact string representation (e.g., 1k, 2.4k, 1M).
 * 
 * @param value The number to format
 * @returns A formatted string
 */
export const formatCompactNumber = (value: number): string => {
    if (value === undefined || value === null) return '0';

    return Intl.NumberFormat('fr-FR', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value).toLowerCase();
};
