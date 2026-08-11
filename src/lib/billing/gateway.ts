/**
 * Payment gateway adapter.
 *
 * Same shape as the other pluggable integrations in this codebase
 * (OtpDeliveryProvider, StorageDriver, Embedder, Llm): one interface, a dev
 * stub, and a factory selected by env. Wiring a real Saudi gateway — Moyasar,
 * Tap, HyperPay, PayTabs — means adding one class here and setting
 * BILLING_GATEWAY; no call site changes.
 *
 * Deliberately NOT wired to a provider yet: no gateway has been chosen and no
 * keys exist. The stub refuses to charge rather than pretending to succeed,
 * so a checkout flow can never silently "work" in a way that looks like a real
 * payment. Everything around it — trial, grace, lock, invoicing — is real.
 *
 * VAT: subscription charges are Saudi-domestic B2B and carry 15% VAT
 * (docs/06). The amount handed to a gateway is always VAT-INCLUSIVE and in
 * halalas; `priceHalalas` on Plan is VAT-exclusive. Never conflate the two.
 */

export type ChargeRequest = {
  /** VAT-inclusive amount in halalas. */
  amountHalalas: number;
  /** ISO-4217; SAR only for now. */
  currency: "SAR";
  /** Our own invoice number, for reconciliation against the gateway. */
  reference: string;
  description: string;
  gatewayCustomerId?: string | null;
};

export type ChargeResult =
  | { ok: true; chargeId: string; customerId: string }
  /** `retryable` distinguishes a declined card from a gateway outage. */
  | { ok: false; code: string; message: string; retryable: boolean };

export interface PaymentGateway {
  readonly name: string;
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

/**
 * Dev stub. Declines every charge with a non-retryable code so the failure
 * path is exercised and nothing is ever recorded as paid by accident.
 */
class UnconfiguredGateway implements PaymentGateway {
  readonly name = "unconfigured";
  async charge(): Promise<ChargeResult> {
    return {
      ok: false,
      code: "GATEWAY_NOT_CONFIGURED",
      message:
        "No payment gateway is configured. Set BILLING_GATEWAY and its credentials once a provider is chosen.",
      retryable: false,
    };
  }
}

let cached: PaymentGateway | null = null;

export function getPaymentGateway(): PaymentGateway {
  if (cached) return cached;
  // switch (process.env.BILLING_GATEWAY) { case "moyasar": ... }
  cached = new UnconfiguredGateway();
  return cached;
}

/** Test hook to reset the memoized gateway. */
export function __resetGateway(): void {
  cached = null;
}
