/**
 * useForm - A comprehensive form management hook
 *
 * Features:
 * - Multi-step form support
 * - Field-level validation
 * - Form-level validation
 * - Dirty state tracking
 * - Error handling
 * - Submit handling with loading state
 * - Reset functionality
 */

import { useState, useCallback, useMemo } from 'react';
import i18n from '../i18n';

// Validation rule type
export type ValidationRule<T> = (value: T, formValues: Record<string, any>) => string | null;

// Field configuration
export interface FieldConfig<T = any> {
  initialValue: T;
  validate?: ValidationRule<T> | ValidationRule<T>[];
  required?: boolean;
  requiredMessage?: string;
}

// Form configuration
export interface FormConfig<T extends Record<string, any>> {
  fields: { [K in keyof T]: FieldConfig<T[K]> };
  onSubmit: (values: T) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

// Field state
export interface FieldState<T = any> {
  value: T;
  error: string | null;
  touched: boolean;
  dirty: boolean;
}

// Form state
export interface FormState<T extends Record<string, any>> {
  values: T;
  errors: Partial<Record<keyof T, string | null>>;
  touched: Partial<Record<keyof T, boolean>>;
  dirty: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  submitCount: number;
}

// Form methods
export interface FormMethods<T extends Record<string, any>> {
  /** Get a field's current value */
  getValue: <K extends keyof T>(field: K) => T[K];
  /** Set a field's value */
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  /** Set multiple values at once */
  setValues: (values: Partial<T>) => void;
  /** Get a field's error */
  getError: <K extends keyof T>(field: K) => string | null;
  /** Set a field's error manually */
  setError: <K extends keyof T>(field: K, error: string | null) => void;
  /** Mark a field as touched */
  setTouched: <K extends keyof T>(field: K) => void;
  /** Validate a specific field */
  validateField: <K extends keyof T>(field: K) => string | null;
  /** Validate all fields */
  validateForm: () => boolean;
  /** Reset the form to initial values */
  reset: () => void;
  /** Reset a specific field */
  resetField: <K extends keyof T>(field: K) => void;
  /** Submit the form */
  handleSubmit: () => Promise<void>;
  /** Get props for a field (for spreading onto Input components) */
  getFieldProps: <K extends keyof T>(field: K) => {
    value: T[K];
    onChangeText: (value: T[K]) => void;
    onBlur: () => void;
    error: string | null;
  };
}

// Return type
export interface UseFormReturn<T extends Record<string, any>> extends FormMethods<T> {
  state: FormState<T>;
}

/**
 * useForm hook
 *
 * @example
 * ```tsx
 * const form = useForm({
 *   fields: {
 *     email: { initialValue: '', required: true, validate: validateEmail },
 *     password: { initialValue: '', required: true, validate: validatePassword },
 *   },
 *   onSubmit: async (values) => {
 *     await loginService.login(values);
 *   },
 * });
 *
 * // In JSX:
 * <Input
 *   label="Email"
 *   {...form.getFieldProps('email')}
 * />
 * <Button
 *   title="Submit"
 *   onPress={form.handleSubmit}
 *   loading={form.state.isSubmitting}
 *   disabled={!form.state.isValid}
 * />
 * ```
 */
export function useForm<T extends Record<string, any>>(config: FormConfig<T>): UseFormReturn<T> {
  const { fields, onSubmit, validateOnChange = true, validateOnBlur = true } = config;

  // Initialize values from field configs
  const initialValues = useMemo(() => {
    const values: Record<string, any> = {};
    for (const key in fields) {
      values[key] = fields[key].initialValue;
    }
    return values as T;
  }, [fields]);

  // State
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string | null>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [dirty, setDirty] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitCount, setSubmitCount] = useState(0);

  /**
   * Validate a single field
   */
  const validateField = useCallback(<K extends keyof T>(field: K): string | null => {
    const fieldConfig = fields[field];
    const value = values[field];

    // Required check
    if (fieldConfig.required) {
      const isEmpty = value === '' || value === null || value === undefined ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) {
        return fieldConfig.requiredMessage || i18n.t('errors.fieldRequired');
      }
    }

    // Custom validation
    if (fieldConfig.validate) {
      const validators = Array.isArray(fieldConfig.validate)
        ? fieldConfig.validate
        : [fieldConfig.validate];

      for (const validator of validators) {
        const error = validator(value, values);
        if (error) {
          return error;
        }
      }
    }

    return null;
  }, [fields, values]);

  /**
   * Validate all fields
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string | null>> = {};
    let isValid = true;

    for (const field in fields) {
      const error = validateField(field as keyof T);
      newErrors[field as keyof T] = error;
      if (error) {
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [fields, validateField]);

  /**
   * Get a field's value
   */
  const getValue = useCallback(<K extends keyof T>(field: K): T[K] => {
    return values[field];
  }, [values]);

  /**
   * Set a field's value
   */
  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValuesState(prev => ({ ...prev, [field]: value }));
    setDirty(prev => ({ ...prev, [field]: true }));

    if (validateOnChange) {
      // Defer validation to next tick to use updated values
      setTimeout(() => {
        const fieldConfig = fields[field];
        const error = (() => {
          // Required check
          if (fieldConfig.required) {
            const isEmpty = value === '' || value === null || value === undefined ||
              (Array.isArray(value) && value.length === 0);
            if (isEmpty) {
              return fieldConfig.requiredMessage || i18n.t('errors.fieldRequired');
            }
          }

          // Custom validation
          if (fieldConfig.validate) {
            const validators = Array.isArray(fieldConfig.validate)
              ? fieldConfig.validate
              : [fieldConfig.validate];

            for (const validator of validators) {
              const validationError = validator(value, { ...values, [field]: value });
              if (validationError) {
                return validationError;
              }
            }
          }

          return null;
        })();

        setErrors(prev => ({ ...prev, [field]: error }));
      }, 0);
    }
  }, [fields, validateOnChange, values]);

  /**
   * Set multiple values at once
   */
  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(prev => ({ ...prev, ...newValues }));
    const newDirty: Partial<Record<keyof T, boolean>> = {};
    for (const key in newValues) {
      newDirty[key as keyof T] = true;
    }
    setDirty(prev => ({ ...prev, ...newDirty }));
  }, []);

  /**
   * Get a field's error
   */
  const getError = useCallback(<K extends keyof T>(field: K): string | null => {
    return errors[field] || null;
  }, [errors]);

  /**
   * Set a field's error manually
   */
  const setError = useCallback(<K extends keyof T>(field: K, error: string | null) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  /**
   * Mark a field as touched
   */
  const setFieldTouched = useCallback(<K extends keyof T>(field: K) => {
    setTouched(prev => ({ ...prev, [field]: true }));

    if (validateOnBlur) {
      const error = validateField(field);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  }, [validateField, validateOnBlur]);

  /**
   * Reset the form
   */
  const reset = useCallback(() => {
    setValuesState(initialValues);
    setErrors({});
    setTouched({});
    setDirty({});
    setSubmitError(null);
  }, [initialValues]);

  /**
   * Reset a specific field
   */
  const resetField = useCallback(<K extends keyof T>(field: K) => {
    setValuesState(prev => ({ ...prev, [field]: fields[field].initialValue }));
    setErrors(prev => ({ ...prev, [field]: null }));
    setTouched(prev => ({ ...prev, [field]: false }));
    setDirty(prev => ({ ...prev, [field]: false }));
  }, [fields]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    setSubmitCount(prev => prev + 1);

    // Validate all fields
    const isValid = validateForm();

    if (!isValid) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit(values);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue';
      setSubmitError(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm, onSubmit, values]);

  /**
   * Get props for a field
   */
  const getFieldProps = useCallback(<K extends keyof T>(field: K) => {
    return {
      value: values[field],
      onChangeText: (value: T[K]) => setValue(field, value),
      onBlur: () => setFieldTouched(field),
      error: touched[field] || submitCount > 0 ? errors[field] || null : null,
    };
  }, [values, setValue, setFieldTouched, touched, errors, submitCount]);

  // Computed state
  const isValid = useMemo(() => {
    for (const field in fields) {
      if (errors[field as keyof T]) {
        return false;
      }
    }
    return true;
  }, [fields, errors]);

  const isDirty = useMemo(() => {
    for (const field in dirty) {
      if (dirty[field as keyof T]) {
        return true;
      }
    }
    return false;
  }, [dirty]);

  // Form state
  const state: FormState<T> = {
    values,
    errors,
    touched,
    dirty,
    isValid,
    isDirty,
    isSubmitting,
    submitError,
    submitCount,
  };

  return {
    state,
    getValue,
    setValue,
    setValues,
    getError,
    setError,
    setTouched: setFieldTouched,
    validateField,
    validateForm,
    reset,
    resetField,
    handleSubmit,
    getFieldProps,
  };
}

// Common validators
export const validators = {
  email: (value: string): string | null => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : 'Email invalide';
  },

  minLength: (min: number) => (value: string): string | null => {
    if (!value) return null;
    return value.length >= min ? null : `Minimum ${min} caractères`;
  },

  maxLength: (max: number) => (value: string): string | null => {
    if (!value) return null;
    return value.length <= max ? null : `Maximum ${max} caractères`;
  },

  phone: (value: string): string | null => {
    if (!value) return null;
    const phoneRegex = /^[+]?[\d\s-]{8,}$/;
    return phoneRegex.test(value) ? null : 'Numéro de téléphone invalide';
  },

  url: (value: string): string | null => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return 'URL invalide';
    }
  },

  match: (fieldName: string, fieldLabel: string) => (value: any, formValues: Record<string, any>): string | null => {
    if (!value) return null;
    return value === formValues[fieldName] ? null : `Doit correspondre à ${fieldLabel}`;
  },

  number: (value: string): string | null => {
    if (!value) return null;
    return !isNaN(Number(value)) ? null : 'Doit être un nombre';
  },

  positiveNumber: (value: string): string | null => {
    if (!value) return null;
    const num = Number(value);
    return !isNaN(num) && num > 0 ? null : 'Doit être un nombre positif';
  },
};

export default useForm;
