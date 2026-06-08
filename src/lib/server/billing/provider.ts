export interface CheckoutSessionInput {
  userId: string;
  planSlug: string;
  successUrl: string;
  cancelUrl: string;
}

export interface BillingProvider {
  createCheckoutSession(input: CheckoutSessionInput): Promise<{ url: string }>;
  handleWebhook(input: { payload: string; signature: string }): Promise<{ processed: boolean }>;
}
