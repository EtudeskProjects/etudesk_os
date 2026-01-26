/**
 * Payment Service
 * Handles payment methods API operations
 */

import { api, ApiResponse } from './api';

export type PaymentProvider = 'orange_money' | 'mtn_money' | 'moov_money' | 'wave' | 'push' | 'djamo';

export interface PaymentMethod {
  id: string;
  provider: PaymentProvider;
  phone: string;
  isDefault: boolean;
}

export interface AddPaymentMethodData {
  provider: PaymentProvider;
  phone: string;
}

export const PAYMENT_PROVIDERS: { id: PaymentProvider; label: string; color: string }[] = [
  { id: 'orange_money', label: 'Orange Money', color: '#FF6600' },
  { id: 'mtn_money', label: 'MTN Money', color: '#FFCC00' },
  { id: 'moov_money', label: 'Moov Money', color: '#0066CC' },
  { id: 'wave', label: 'Wave', color: '#1DC7EA' },
  { id: 'push', label: 'Push', color: '#22C55E' },
  { id: 'djamo', label: 'Djamo', color: '#6B4EFF' },
];

/**
 * Get all payment methods for current user
 */
async function getPaymentMethods(): Promise<ApiResponse<PaymentMethod[]>> {
  return api.get<PaymentMethod[]>('/api/payment-methods');
}

/**
 * Add a new payment method
 */
async function addPaymentMethod(data: AddPaymentMethodData): Promise<ApiResponse<PaymentMethod>> {
  return api.post<PaymentMethod>('/api/payment-methods', data);
}

/**
 * Set a payment method as default
 */
async function setDefaultPaymentMethod(id: string): Promise<ApiResponse<PaymentMethod[]>> {
  return api.put<PaymentMethod[]>(`/api/payment-methods/${id}/default`);
}

/**
 * Delete a payment method
 */
async function deletePaymentMethod(id: string): Promise<ApiResponse<PaymentMethod[]>> {
  return api.delete<PaymentMethod[]>(`/api/payment-methods/${id}`);
}

/**
 * Get provider info by ID
 */
function getProviderInfo(providerId: PaymentProvider) {
  return PAYMENT_PROVIDERS.find(p => p.id === providerId);
}

export const paymentService = {
  getPaymentMethods,
  addPaymentMethod,
  setDefaultPaymentMethod,
  deletePaymentMethod,
  getProviderInfo,
  PAYMENT_PROVIDERS,
};
