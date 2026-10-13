/**
 * Payment provider layer for mobile-money payments (EVC Plus, eDahab, Premier Wallet).
 *
 * Today every method uses the MANUAL provider: the customer pays to the SOORAR number shown
 * on the website and submits the transaction reference; an admin approves or rejects it.
 *
 * To plug in Waafi (WaafiPay API) later: implement `verify()` in `waafiProvider` using the
 * merchant credentials (env WAAFI_MERCHANT_UID, WAAFI_API_USER_ID, WAAFI_API_KEY) and return
 * { status: 'Approved' } when the transaction is confirmed. Submissions it approves are
 * recorded exactly like a manual approval (see recordApprovedSubmission in extensions.ts).
 */
export type SubmissionStatus = 'Pending' | 'Approved' | 'Rejected';

export interface PaymentSubmissionInput {
  method: string;
  transactionRef: string;
  amount: number;
  payerPhone: string;
  bookingRef: string;
}

export interface PaymentProvider {
  id: string;
  label: string;
  methods: string[];
  /** Is the provider configured and allowed to auto-verify? */
  enabled(): boolean;
  /** Try to verify a submission. Manual provider always returns Pending. */
  verify(input: PaymentSubmissionInput): Promise<{ status: SubmissionStatus; payload?: Record<string, any>; note?: string }>;
}

export const PAYMENT_METHODS = ['EVC Plus', 'eDahab', 'Premier Wallet'] as const;

export const manualProvider: PaymentProvider = {
  id: 'manual',
  label: 'Manual verification (admin)',
  methods: [...PAYMENT_METHODS],
  enabled: () => true,
  async verify() {
    return { status: 'Pending' };
  },
};

export const waafiProvider: PaymentProvider = {
  id: 'waafi',
  label: 'WaafiPay API',
  methods: ['EVC Plus', 'eDahab', 'Premier Wallet'],
  enabled: () =>
    process.env.WAAFI_ENABLED === 'true' &&
    !!process.env.WAAFI_MERCHANT_UID &&
    !!process.env.WAAFI_API_USER_ID &&
    !!process.env.WAAFI_API_KEY,
  async verify() {
    // Not implemented yet: no merchant credentials. Falls back to manual review.
    return { status: 'Pending', note: 'Waafi verification not implemented; manual review.' };
  },
};

export function getPaymentProvider(method: string): PaymentProvider {
  if (waafiProvider.enabled() && waafiProvider.methods.includes(method)) return waafiProvider;
  return manualProvider;
}

export const PAYMENT_NUMBER_SETTING: Record<string, string> = {
  'EVC Plus': 'pay_evc_number',
  eDahab: 'pay_edahab_number',
  'Premier Wallet': 'pay_premier_number',
};
