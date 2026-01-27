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

/**
 * Formats a number as an integer (no decimals), with locale formatting.
 * Removes .00 and any decimal places from numbers.
 *
 * @param value The number to format
 * @returns A formatted string without decimals
 */
export const formatInteger = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '0';
    return Math.round(value).toLocaleString('fr-FR');
};

/**
 * Formats a price in XOF (CFA Francs) with locale formatting.
 *
 * @param value The price to format
 * @param showCurrency Whether to show the currency suffix (default: true)
 * @returns A formatted price string
 */
export const formatPrice = (value: number | undefined | null, showCurrency: boolean = false): string => {
    if (value === undefined || value === null) return '0';
    const formatted = Math.round(value).toLocaleString('fr-FR');
    return showCurrency ? `${formatted} FCFA` : formatted;
};
