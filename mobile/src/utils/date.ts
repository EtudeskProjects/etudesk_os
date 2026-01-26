/**
 * Date utilities for human-readable date formatting with i18n support
 */

import i18n, { Language } from '../i18n';

type TranslationFunction = (key: string, options?: Record<string, string | number>) => string;

// Get current locale
const getLocale = (): string => i18n.locale || 'fr';

// Create a translation function that uses i18n
const t: TranslationFunction = (key: string, options?: Record<string, string | number>): string => {
  return i18n.t(key, options);
};

/**
 * Returns a human-readable relative time string
 * @param date - Date string or Date object
 * @param locale - Optional locale override
 * @returns Human-readable string like "il y a 2 jours" or "2 days ago"
 */
export function formatRelativeTime(date: string | Date, locale?: Language): string {
  const currentLocale = locale || getLocale();
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - targetDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  // Use i18n for translations
  if (diffSeconds < 60) {
    return t('date.justNow');
  }

  if (diffMinutes < 60) {
    return t('date.minutesAgo', { minutes: diffMinutes });
  }

  if (diffHours < 24) {
    return t('date.hoursAgo', { hours: diffHours });
  }

  if (diffDays === 1) {
    return t('date.yesterday');
  }

  if (diffDays < 7) {
    return t('date.daysAgo', { days: diffDays });
  }

  if (diffWeeks < 4) {
    if (currentLocale === 'fr') {
      return diffWeeks === 1 ? 'Il y a 1 semaine' : `Il y a ${diffWeeks} semaines`;
    }
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  }

  if (diffMonths < 12) {
    if (currentLocale === 'fr') {
      return diffMonths === 1 ? 'Il y a 1 mois' : `Il y a ${diffMonths} mois`;
    }
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  }

  if (currentLocale === 'fr') {
    return diffYears === 1 ? 'Il y a 1 an' : `Il y a ${diffYears} ans`;
  }
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
}

/**
 * Formats a deadline date with urgency indication
 * @param deadline - Deadline date string
 * @param locale - Optional locale override
 * @returns Formatted deadline string with urgency
 */
export function formatDeadline(deadline: string | Date, locale?: Language): { text: string; isUrgent: boolean } {
  const currentLocale = locale || getLocale();
  const now = new Date();
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: t('date.expired'), isUrgent: true };
  }

  if (diffDays === 0) {
    return { text: t('date.today'), isUrgent: true };
  }

  if (diffDays === 1) {
    return { text: t('date.tomorrow'), isUrgent: true };
  }

  if (diffDays <= 3) {
    return { text: t('date.inDays', { days: diffDays }), isUrgent: true };
  }

  if (diffDays <= 7) {
    return { text: t('date.inDays', { days: diffDays }), isUrgent: false };
  }

  if (diffDays <= 30) {
    const weeks = Math.floor(diffDays / 7);
    if (currentLocale === 'fr') {
      return { text: weeks === 1 ? 'Dans 1 semaine' : `Dans ${weeks} semaines`, isUrgent: false };
    }
    return { text: weeks === 1 ? 'In 1 week' : `In ${weeks} weeks`, isUrgent: false };
  }

  const months = Math.floor(diffDays / 30);
  if (currentLocale === 'fr') {
    return { text: months === 1 ? 'Dans 1 mois' : `Dans ${months} mois`, isUrgent: false };
  }
  return { text: months === 1 ? 'In 1 month' : `In ${months} months`, isUrgent: false };
}

/**
 * Formats a date in the current locale format
 * @param date - Date string or Date object
 * @param locale - Optional locale override
 * @returns Formatted date string like "15 janvier 2024" or "January 15, 2024"
 */
export function formatDate(date: string | Date, locale?: Language): string {
  const currentLocale = locale || getLocale();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const localeCode = currentLocale === 'en' ? 'en-US' : 'fr-FR';

  return targetDate.toLocaleDateString(localeCode, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formats a short date
 * @param date - Date string or Date object
 * @param locale - Optional locale override
 * @returns Formatted date string like "15 jan." or "Jan 15"
 */
export function formatShortDate(date: string | Date, locale?: Language): string {
  const currentLocale = locale || getLocale();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const localeCode = currentLocale === 'en' ? 'en-US' : 'fr-FR';

  return targetDate.toLocaleDateString(localeCode, {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Formats a time
 * @param date - Date string or Date object
 * @param locale - Optional locale override
 * @returns Formatted time string like "14:30" or "2:30 PM"
 */
export function formatTime(date: string | Date, locale?: Language): string {
  const currentLocale = locale || getLocale();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const localeCode = currentLocale === 'en' ? 'en-US' : 'fr-FR';

  return targetDate.toLocaleTimeString(localeCode, {
    hour: '2-digit',
    minute: '2-digit',
  });
}
