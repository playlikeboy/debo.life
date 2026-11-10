// @debo/llm: the one door for every model call (see docs/BYOK-AND-PLANS.md).
//
// Calls go through the Neon AI Gateway with the Vercel AI SDK. Model ids are
// gateway catalog ids. Usage rows and "your own key" come later; this is the
// smallest working door.
import { createNeon } from "@neon/ai-sdk-provider";
import { generateText } from "ai";
import { z } from "zod";

const GatewayEnv = z.object({
  NEON_AI_GATEWAY_BASE_URL: z.string().url(),
  NEON_AI_GATEWAY_TOKEN: z.string().min(1),
});

/** Small, fast model for everyday answers. */
export const DEFAULT_MODEL = "claude-haiku-5-5";

export function createLlm(env: Record<string, string | undefined>) {
  const parsed = GatewayEnv.parse(env);
  const provider = createNeon({
    baseURL: parsed.NEON_AI_GATEWAY_BASE_URL,
    apiKey: parsed.NEON_AI_GATEWAY_TOKEN,
  });

  return {
    /**
     * One short text answer. Never log the prompt or the answer: they may hold
     * a person's notes.
     */
    async generate(prompt: string, model: string = DEFAULT_MODEL) {
      const result = await generateText({ model: provider(model), prompt, maxOutputTokens: 200 });
      return { text: result.text, usage: result.usage };
    },
  };
}

export type Llm = ReturnType<typeof createLlm>;
