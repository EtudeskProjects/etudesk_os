/**
 * Hooks Index
 * Export all custom hooks from a single entry point
 */

export { useTheme } from './useTheme';
export { useNotifications } from './useNotifications';
export { useGeolocation } from './useGeolocation';

// Data fetching
export {
  useDataFetching,
  clearAllCache,
  clearCacheByPrefix,
  invalidateCache
} from './useDataFetching';
export type {
  UseDataFetchingConfig,
  UseDataFetchingResult
} from './useDataFetching';

// Form management
export { useForm, validators } from './useForm';
export type {
  FieldConfig,
  FormConfig,
  FieldState,
  FormState,
  FormMethods,
  UseFormReturn,
  ValidationRule,
} from './useForm';
