import type { Llm, LlmRequest } from "./llm";

/**
 * Multi-provider model routing.
 *
 * The product must not be locked to one vendor. A single provider is a single
 * point of failure for availability, a single negotiating position on price,
 * and a single regulatory exposure — and the last one dominates here.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PDPL CONSTRAINT — read before adding a provider.
 *
 * Case data is personal data that must stay in-Kingdom (CLAUDE.md, docs/02
 * §7). A provider is only eligible for CASE-BEARING traffic if it serves from
 * inside Saudi Arabia — in practice Claude on Vertex AI at me-central2, or a
 * model you host yourself in the same region.
 *
 * Sending a case summary to a general public API endpoint outside the Kingdom
 * is a compliance breach regardless of how good the model is. That is why
 * every provider below carries an explicit `residency` flag and the router
 * refuses to send case-bearing work to an out-of-Kingdom provider. Do not
 * relax that check to fix a failing request.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Where the provider physically serves inference. */
export type Residency =
  /** Serves from inside Saudi Arabia — eligible for case data. */
  | "in-kingdom"
  /** Serves elsewhere — general/non-case use only. */
  | "external"
  /** Runs on our own infrastructure wherever we deploy it. */
  | "self-hosted";

export type ProviderId = "vertex-claude" | "anthropic-direct" | "openai-compatible" | "local" | "stub";

export type ProviderSpec = {
  id: ProviderId;
  residency: Residency;
  /** Rough output cost per million tokens, for routing cheapest-capable. */
  costPerMTokOut: number;
  /** Present only when the provider is actually configured. */
  create: () => Llm | null;
};

/** Does this request carry tenant case data? */
export function isCaseBearing(req: LlmRequest): boolean {
  // Any retrieved KB passage or an arena role means we are reasoning about a
  // specific matter. Conservative by design: when unsure, treat as case data.
  return req.sources.length > 0 || Boolean(req.arenaRole);
}

/**
 * Registry, most-preferred first.
 *
 * Each `create` returns null when its credentials are absent, so an
 * unconfigured provider is skipped rather than throwing at import time.
 */
export const PROVIDERS: ProviderSpec[] = [
  {
    // The production target per CLAUDE.md: Claude on Vertex, regional endpoint.
    id: "vertex-claude",
    residency: "in-kingdom",
    costPerMTokOut: 5,
    create: () => null, // wired when a GCP project + service account exist
  },
  {
    // Direct Anthropic API. Strong models, but served outside the Kingdom, so
    // it is deliberately NOT eligible for case-bearing traffic.
    id: "anthropic-direct",
    residency: "external",
    costPerMTokOut: 5,
    create: () => null, // see src/lib/ai/hearing-draft.ts for the existing call
  },
  {
    // Any OpenAI-compatible endpoint — OpenAI itself, Azure, Groq, Together,
    // or a self-hosted vLLM. Residency depends entirely on where it points,
    // so it is treated as external unless AI_LOCAL_BASE_URL is used instead.
    id: "openai-compatible",
    residency: "external",
    costPerMTokOut: 10,
    create: () => null,
  },
  {
    // Open-weights model on our own infrastructure, in-region. The escape
    // hatch that keeps case data in-Kingdom without depending on any vendor.
    id: "local",
    residency: "self-hosted",
    costPerMTokOut: 0,
    create: () => null,
  },
];

export type RouteDecision = {
  provider: ProviderId;
  /** Ordered fallbacks, already filtered for eligibility. */
  fallbacks: ProviderId[];
  reason: string;
};

/**
 * Choose a provider for a request.
 *
 * Eligibility first, cost second. A cheaper provider never wins if it is
 * ineligible on residency grounds — the ordering cannot be inverted by tuning
 * a price.
 */
export function route(
  req: LlmRequest,
  available: ProviderSpec[] = PROVIDERS.filter((p) => p.create() !== null),
): RouteDecision | null {
  const caseBearing = isCaseBearing(req);

  const eligible = available.filter((p) =>
    caseBearing ? p.residency === "in-kingdom" || p.residency === "self-hosted" : true,
  );

  if (eligible.length === 0) {
    return null;
  }

  const ordered = [...eligible].sort((a, b) => a.costPerMTokOut - b.costPerMTokOut);
  const [first, ...rest] = ordered;

  return {
    provider: first!.id,
    fallbacks: rest.map((p) => p.id),
    reason: caseBearing
      ? "case-bearing: restricted to in-kingdom or self-hosted providers"
      : "no case data: any configured provider is eligible",
  };
}
