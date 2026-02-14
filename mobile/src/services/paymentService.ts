/**
 * Payment Service
 * Handles payment methods API operations
 */

import { api, ApiResponse } from './api';
import { BRAND_COLORS } from '../constants/theme';

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
  { id: 'orange_money', label: 'Orange Money', color: BRAND_COLORS.orangeMoney },
  { id: 'mtn_money', label: 'MTN Money', color: BRAND_COLORS.mtnMoney },
  { id: 'moov_money', label: 'Moov Money', color: BRAND_COLORS.moovMoney },
  { id: 'wave', label: 'Wave', color: BRAND_COLORS.wave },
  { id: 'push', label: 'Push', color: BRAND_COLORS.push },
  { id: 'djamo', label: 'Djamo', color: BRAND_COLORS.djamo },
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
  return api.put<PaymentMethod[]>(`/api/payment-methods/${id}/default`, {});
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
