import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { ErrorCode } from "@murafaa/contracts";
import type { Env } from "../../config/env.js";
import { ApiException } from "../../common/http/api.exception.js";

export type LlmRequest = { system: string; prompt: string; maxTokens?: number };
export type LlmReply = { text: string; model: string };

/**
 * The one provider-specific piece of the legal-AI pipeline. Retrieval, the
 * citation gate, PII redaction and the audit trail do not depend on it, so a
 * different provider is one more implementation of this interface.
 */
export interface LlmProvider {
  readonly name: string;
  readonly connected: boolean;
  readonly region: string | null;
  generate(req: LlmRequest): Promise<LlmReply>;
}

export const LLM = Symbol("LLM");

const unavailable = () =>
  new ApiException(ErrorCode.UNAVAILABLE, undefined, "errors.AI_UNAVAILABLE");

/** No provider configured: every request is refused; nothing is generated in its place. */
class NotConnected implements LlmProvider {
  readonly name = "none";
  readonly connected = false;
  readonly region = null;
  generate(): Promise<LlmReply> {
    return Promise.reject(unavailable());
  }
}

/** Claude on Vertex AI, regional endpoint (docs/02 §6). Credentials come from the Cloud Run service account. */
class VertexClaude implements LlmProvider {
  readonly name = "vertex";
  readonly connected = true;
  private readonly client: AnthropicVertex;

  constructor(
    projectId: string,
    readonly region: string,
    private readonly model: string,
  ) {
    this.client = new AnthropicVertex({ projectId, region });
  }

  async generate(req: LlmRequest): Promise<LlmReply> {
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 1500,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
      });
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      return { text, model: res.model };
    } catch {
      throw unavailable();
    }
  }
}

export function llmFor(env: Env): LlmProvider {
  return env.AI_PROVIDER === "vertex"
    ? new VertexClaude(env.VERTEX_PROJECT_ID!, env.VERTEX_REGION, env.AI_MODEL!)
    : new NotConnected();
}
