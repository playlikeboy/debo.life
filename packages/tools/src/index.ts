// @debo/tools: the one shape every tool Debo can use must have.
//
// A tool never decides whether it may run. The policy engine (@debo/tasks)
// looks at `risk` and the person's settings and answers allow, ask or deny
// before `run` is called. An "ask" is approved against the exact input, so
// `preview` must show everything that matters about that input.
//
// Tool output from the web, files, email or other services is data, not
// instructions. Nothing a tool returns can grant permission for anything.
import type { z } from "zod";

/**
 * How much harm a tool can do. The policy engine maps this to allow, ask or deny.
 * - read: reads the person's own data or the public web. Changes nothing.
 * - local: changes something inside Debo that the person can undo (a draft, a note).
 * - external-write: changes something outside Debo (sends, posts, books, creates).
 * - destructive: deletes or overwrites, inside or outside Debo.
 * - admin: changes accounts, keys, permissions or money.
 */
export type ToolRisk = "read" | "local" | "external-write" | "destructive" | "admin";

export type ToolContext = {
  userId: string;
  /** Set when the tool runs inside a task, so receipts can link back to it. */
  taskId?: string;
  signal?: AbortSignal;
  /** Server-side settings and secrets. Never sent to the browser or the model. */
  env: Record<string, string | undefined>;
  /** Cloudflare bindings (AI, BROWSER, ...) when running on Workers. */
  bindings?: Record<string, unknown>;
};

/** Something a tool made that the person can open later. */
export type Artifact = { kind: "document" | "screenshot" | "file" | "link" | "text"; ref: string; label: string };

export type ToolResult =
  | {
      ok: true;
      /** Data for the model. Treated as untrusted. */
      output: unknown;
      /** One plain sentence for the person: what happened. Saved in the receipt. */
      summary: string;
      artifacts?: Artifact[];
    }
  | { ok: false; error: string };

export type Tool<I = unknown> = {
  /** Stable id, like "browser.read_page". Lowercase, dot-separated. */
  name: string;
  /** Short plain-English name for the screen, like "Read a web page". */
  title: string;
  /** For the model: when to use this tool. */
  description: string;
  risk: ToolRisk;
  input: z.ZodType<I>;
  /** The exact action in plain words, shown before approval. Must include every value that matters. */
  preview(input: I): string;
  run(input: I, ctx: ToolContext): Promise<ToolResult>;
};

/** Keeps the input type when writing a tool. */
export function defineTool<I>(tool: Tool<I>): Tool<I> {
  return tool;
}

// `any` because a registry holds tools whose inputs have different types.
export type AnyTool = Tool<any>;
