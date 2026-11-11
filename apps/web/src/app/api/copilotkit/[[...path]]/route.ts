import { getAuth } from "@/lib/auth/server";
import { AGENT_ID } from "@/lib/chat";
import { RUNTIME_INFO } from "@/lib/copilot-info";

export const dynamic = "force-dynamic";

// No usage data leaves Debo for CopilotKit's telemetry (AGENTS.md: no
// analytics that send data to a third party). The runtime reads this each time.
process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";

const BASE_PATH = "/api/copilotkit";

/**
 * The CopilotKit runtime and Debo's agent, loaded only when a request needs
 * them. They are large: loading them on a cold Worker costs about half a
 * second of CPU, so /info (asked each time the chat opens) skips them.
 * The import is cached for the life of the Worker; nothing about a person is.
 */
async function loadRuntime() {
  const [{ CopilotRuntime, createCopilotRuntimeHandler }, { createDeboAgent }] = await Promise.all([
    import("@copilotkit/runtime/v2"),
    import("@/lib/copilot-agent"),
  ]);
  return { CopilotRuntime, createCopilotRuntimeHandler, createDeboAgent };
}

/**
 * The CopilotKit runtime endpoint for the chat page, signed-in people only.
 * The agent is built per request for that person, so it can only ever read
 * their own entries.
 */
async function handle(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    // Only accept writes from our own pages, never from another site.
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return Response.json({ error: "This request must come from Debo itself." }, { status: 403 });
    }
  }

  const { data: session } = await getAuth().getSession();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first, then try again." }, { status: 401 });

  // The same for everyone, and checked against the runtime by copilot-info.test.ts.
  if (request.method === "GET" && new URL(request.url).pathname === `${BASE_PATH}/info`) {
    return Response.json(RUNTIME_INFO);
  }

  const { CopilotRuntime, createCopilotRuntimeHandler, createDeboAgent } = await loadRuntime();
  // Built fresh for every request, so a runtime and its agent never outlive one person's request.
  const runtime = new CopilotRuntime({
    agents: { [AGENT_ID]: createDeboAgent(userId) },
    // Scope chat threads to this person. Only the id; CopilotKit needs no name or email.
    identifyUser: () => ({ id: userId, name: userId }),
  });
  return createCopilotRuntimeHandler({ runtime, basePath: BASE_PATH })(request);
}

export const GET = handle;
export const POST = handle;
