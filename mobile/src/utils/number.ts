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
 * Converts a number-like value to a valid number.
 *
 * @param value The value to parse
 * @returns Parsed number, or null when invalid
 */
export const toNumberOrNull = (value: number | string | undefined | null): number | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Formats a number-like value with locale separators and no useless trailing zeros.
 * Examples: "2.00" -> "2", "2.50" -> "2,5"
 *
 * @param value The value to format
 * @param maximumFractionDigits Maximum decimals to keep (default: 2)
 * @returns A locale-formatted string
 */
export const formatNumberNoTrailingZeros = (
    value: number | string | undefined | null,
    maximumFractionDigits: number = 2
): string => {
    const parsed = toNumberOrNull(value);
    if (parsed === null) return '0';

    return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits,
    }).format(parsed);
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
