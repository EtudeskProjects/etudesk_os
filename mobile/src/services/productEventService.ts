import { api } from './api';

export type ProductEventName =
  | 'onboarding_completed' | 'welcome_started' | 'first_goal_selected' | 'community_joined'
  | 'challenge_started' | 'challenge_completed' | 'opportunity_opened' | 'application_started'
  | 'application_submitted' | 'credit_checkout_started';

export async function trackProductEvent(name: ProductEventName, properties: Record<string, unknown> = {}): Promise<void> {
  try { await api.post('/product-events', { name, properties }); } catch { /* analytics must never interrupt the user flow */ }
}
